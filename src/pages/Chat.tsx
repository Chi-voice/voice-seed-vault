import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RecordingModal } from '@/components/RecordingModal';
import { 
  ArrowLeft, 
  Mic, 
  Play, 
  Pause,
  ChevronRight,
  Clock,
  Volume2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Message {
  id: string;
  type: 'system' | 'user';
  content: string;
  taskType: 'word' | 'phrase' | 'sentence';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
  audioUrl?: string;
  isCompleted?: boolean;
  timestamp: Date;
}

interface Language {
  id: string;
  name: string;
  code: string;
}

const Chat = () => {
  const { languageId } = useParams<{ languageId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [language, setLanguage] = useState<Language | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Message | null>(null);
  const [generatingTask, setGeneratingTask] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (!user) {
        navigate('/auth');
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (languageId && user) {
      loadLanguage();
    }
  }, [languageId, user]);

  useEffect(() => {
    if (language && user) {
      loadChatHistory();
    }
  }, [language, user]);

  // Auto-generate first task if no messages exist
  useEffect(() => {
    if (messages.length === 0 && language && user && !generatingTask) {
      generateNextTask();
    }
  }, [messages, language, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadLanguage = async () => {
    if (!languageId) return;

    try {
      // First try to find language by ID (UUID)
      let { data, error } = await supabase
        .from('languages')
        .select('*')
        .eq('id', languageId)
        .maybeSingle();

      // If not found by UUID, try to find by code (Glottolog ID)
      if (!data && !error) {
        const { data: codeData, error: codeError } = await supabase
          .from('languages')
          .select('*')
          .eq('code', languageId)
          .maybeSingle();
        
        data = codeData;
        error = codeError;
      }

      // If still not found, create the language from Glottolog data
      if (!data && !error) {
        // Import glottolog parser and find the language
        const { getGlottologLanguages } = await import('@/utils/glottologParser');
        const glottologLanguages = await getGlottologLanguages();
        const glottologLang = glottologLanguages.find(lang => lang.id === languageId);
        
        if (glottologLang) {
          const { data: newLang, error: createError } = await supabase
            .from('languages')
            .insert({
              name: glottologLang.name,
              code: glottologLang.id,
              is_popular: false
            })
            .select()
            .single();
          
          if (createError) throw createError;
          data = newLang;
        } else {
          throw new Error('Language not found');
        }
      }

      if (error) throw error;
      setLanguage(data);
    } catch (error: any) {
      toast({
        title: "Error loading language",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadChatHistory = async () => {
    if (!languageId || !user || !language) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          recordings!left(id, user_id, audio_url, created_at)
        `)
        .eq('language_id', language.id) // Use the actual database language ID
        .order('created_at', { ascending: true });

      if (error) throw error;

      const chatMessages: Message[] = [];
      
      data?.forEach(task => {
        // Add system message (task prompt)
        chatMessages.push({
          id: task.id,
          type: 'system',
          content: task.english_text,
          taskType: task.type as 'word' | 'phrase' | 'sentence',
          difficulty: task.difficulty as 'beginner' | 'intermediate' | 'advanced',
          estimatedTime: task.estimated_time,
          timestamp: new Date(task.created_at)
        });

        // Add user recording if exists
        const userRecording = task.recordings?.find((r: any) => r.user_id === user.id);
        if (userRecording) {
          chatMessages.push({
            id: `${task.id}-recording`,
            type: 'user',
            content: `Recorded: "${task.english_text}"`,
            taskType: task.type as 'word' | 'phrase' | 'sentence',
            difficulty: task.difficulty as 'beginner' | 'intermediate' | 'advanced',
            estimatedTime: task.estimated_time,
            audioUrl: userRecording.audio_url,
            isCompleted: true,
            timestamp: new Date(userRecording.created_at)
          });
        }
      });

      setMessages(chatMessages);
    } catch (error: any) {
      toast({
        title: "Error loading chat history",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateNextTask = async () => {
    if (!language || !user) return;

    setGeneratingTask(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-task', {
        body: {
          language_id: language.id, // Use the actual database language ID
          user_id: user.id
        }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Task Generation",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      // Reload chat to show new task
      loadChatHistory();
      
      toast({
        title: "New task generated!",
        description: "Ready for your next recording.",
      });
    } catch (error: any) {
      toast({
        title: "Error generating task",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingTask(false);
    }
  };

  const handleStartRecording = (message: Message) => {
    setCurrentTask(message);
    setIsRecordingModalOpen(true);
  };

  const handleSubmitRecording = async (taskId: string, audioBlob: Blob, notes?: string) => {
    if (!user) return;
    
    try {
      const fileName = `${user.id}/${taskId}_${Date.now()}.webm`;
      const audioUrl = `placeholder_${fileName}`;
      
      const { error } = await supabase
        .from('recordings')
        .insert({
          user_id: user.id,
          task_id: taskId,
          audio_url: audioUrl,
          notes: notes,
          duration: 0
        });
      
      if (error) throw error;
      
      toast({
        title: "Recording saved!",
        description: "Your translation has been saved successfully.",
      });
      
      loadChatHistory();
    } catch (error: any) {
      toast({
        title: "Error saving recording",
        description: error.message,
        variant: "destructive",
      });
    }
    
    setIsRecordingModalOpen(false);
    setCurrentTask(null);
  };

  const playAudio = (audioUrl: string) => {
    if (playingAudio === audioUrl) {
      setPlayingAudio(null);
    } else {
      setPlayingAudio(audioUrl);
      // Implement audio playback logic here
    }
  };

  const getNextIncompleteTask = () => {
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.type === 'system') {
        const nextMessage = messages[i + 1];
        if (!nextMessage || nextMessage.type !== 'user') {
          return message;
        }
      }
    }
    return null;
  };

  const nextIncompleteTask = getNextIncompleteTask();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/chats')}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold text-lg">{language?.name}</h1>
          <p className="text-sm text-muted-foreground">
            {messages.filter(m => m.type === 'user').length} recordings completed
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card className={`max-w-[80%] p-4 ${
              message.type === 'user' 
                ? 'bg-earth-primary text-white' 
                : 'bg-card'
            }`}>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {message.taskType}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {message.difficulty}
                  </Badge>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{message.estimatedTime}min</span>
                  </div>
                </div>
                
                <p className="text-sm">{message.content}</p>
                
                {message.type === 'user' && message.audioUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => playAudio(message.audioUrl!)}
                    className="p-1 h-8 w-8"
                  >
                    {playingAudio === message.audioUrl ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                )}
                
                {message.type === 'system' && !messages.find(m => 
                  m.id === `${message.id}-recording` && m.type === 'user'
                ) && (
                  <Button
                    size="sm"
                    onClick={() => handleStartRecording(message)}
                    className="bg-earth-primary hover:bg-earth-primary/90"
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Record
                  </Button>
                )}
              </div>
            </Card>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-border p-4">
        {nextIncompleteTask ? (
          <Button
            onClick={() => handleStartRecording(nextIncompleteTask)}
            className="w-full bg-earth-primary hover:bg-earth-primary/90"
            size="lg"
          >
            <Mic className="w-5 h-5 mr-2" />
            Record Current Task
          </Button>
        ) : (
          <Button
            onClick={generateNextTask}
            disabled={generatingTask}
            className="w-full bg-earth-primary hover:bg-earth-primary/90"
            size="lg"
          >
            <ChevronRight className="w-5 h-5 mr-2" />
            {generatingTask ? 'Generating...' : 'Next Task'}
          </Button>
        )}
      </div>

      {/* Recording Modal */}
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={() => setIsRecordingModalOpen(false)}
        task={currentTask ? {
          id: currentTask.id,
          type: currentTask.taskType,
          englishText: currentTask.content,
          description: '',
          difficulty: currentTask.difficulty,
          estimatedTime: currentTask.estimatedTime,
          sequenceOrder: 0,
          isStarterTask: false,
          isCompleted: false
        } : null}
        onSubmit={handleSubmitRecording}
      />
    </div>
  );
};

export default Chat;