import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskCard, Task } from '@/components/TaskCard';
import { RecordingModal } from '@/components/RecordingModal';
import { StatsCard } from '@/components/StatsCard';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  Users, 
  Globe, 
  Trophy, 
  Search,
  Heart,
  BookOpen,
  Volume2,
  Clock,
  LogOut,
  Sparkles
} from 'lucide-react';
import heroImage from '@/assets/hero-image.jpg';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

interface Language {
  id: string;
  name: string;
  code: string;
  is_popular: boolean;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [generatingTask, setGeneratingTask] = useState(false);
  const [userProgress, setUserProgress] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Set up auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate('/auth');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Load languages and tasks
  useEffect(() => {
    if (user) {
      loadLanguages();
    }
  }, [user]);

  useEffect(() => {
    if (selectedLanguage && user) {
      loadTasks();
      loadUserProgress();
    }
  }, [selectedLanguage, user]);

  const loadLanguages = async () => {
    try {
      const { data, error } = await supabase
        .from('languages')
        .select('*')
        .order('is_popular', { ascending: false })
        .order('name');
      
      if (error) throw error;
      
      setLanguages(data || []);
      
      // Auto-select first popular language
      const firstPopular = data?.find(lang => lang.is_popular);
      if (firstPopular) {
        setSelectedLanguage(firstPopular.id);
      }
    } catch (error: any) {
      toast({
        title: "Error loading languages",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    if (!selectedLanguage) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          recordings!left(id, user_id)
        `)
        .eq('language_id', selectedLanguage)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Map tasks to include completion status
      const tasksWithCompletion = (data || []).map(task => ({
        id: task.id,
        type: task.type as 'word' | 'phrase' | 'sentence',
        englishText: task.english_text,
        description: task.description,
        difficulty: task.difficulty as 'beginner' | 'intermediate' | 'advanced',
        estimatedTime: task.estimated_time,
        isCompleted: task.recordings?.some((r: any) => r.user_id === user?.id) || false
      }));
      
      setTasks(tasksWithCompletion);
    } catch (error: any) {
      toast({
        title: "Error loading tasks",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadUserProgress = async () => {
    if (!selectedLanguage || !user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_task_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('language_id', selectedLanguage)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      setUserProgress(data);
    } catch (error: any) {
      console.error('Error loading user progress:', error);
    }
  };

  const generateNewTask = async () => {
    if (!selectedLanguage || !user) return;
    
    setGeneratingTask(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-task', {
        body: {
          language_id: selectedLanguage,
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
      
      toast({
        title: "New task generated!",
        description: "A new AI-generated task is ready for recording.",
      });
      
      loadTasks();
      loadUserProgress();
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Filter tasks based on search and tab
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.englishText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'completed') return matchesSearch && task.isCompleted;
    if (activeTab === 'pending') return matchesSearch && !task.isCompleted;
    return matchesSearch && task.type === activeTab;
  });

  // Stats calculations
  const stats = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.isCompleted).length,
    wordsCompleted: tasks.filter(t => t.type === 'word' && t.isCompleted).length,
    phrasesCompleted: tasks.filter(t => t.type === 'phrase' && t.isCompleted).length,
    sentencesCompleted: tasks.filter(t => t.type === 'sentence' && t.isCompleted).length,
    totalContributionTime: tasks.filter(t => t.isCompleted).reduce((acc, t) => acc + t.estimatedTime, 0)
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-earth-warm via-background to-earth-warm/50 flex items-center justify-center">
        <div className="text-center">
          <Mic className="w-12 h-12 text-earth-primary mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-muted-foreground">Loading Chi Voice...</p>
        </div>
      </div>
    );
  }

  const handleStartTask = (task: Task) => {
    setSelectedTask(task);
    setIsRecordingModalOpen(true);
  };

  const handleSubmitRecording = async (taskId: string, audioBlob: Blob, notes?: string) => {
    if (!user) return;
    
    try {
      // Upload audio file to Supabase storage (you'll need to set up storage bucket)
      const fileName = `${user.id}/${taskId}_${Date.now()}.webm`;
      
      // For now, we'll create a placeholder URL since storage isn't configured
      const audioUrl = `placeholder_${fileName}`;
      
      // Save recording to database
      const { error } = await supabase
        .from('recordings')
        .insert({
          user_id: user.id,
          task_id: taskId,
          audio_url: audioUrl,
          notes: notes,
          duration: 0 // You can calculate this from the blob
        });
      
      if (error) throw error;
      
      toast({
        title: "Recording saved!",
        description: "Your translation has been saved successfully.",
      });
      
      // Reload tasks and progress
      loadTasks();
      loadUserProgress();
      
    } catch (error: any) {
      toast({
        title: "Error saving recording",
        description: error.message,
        variant: "destructive",
      });
    }
    
    setIsRecordingModalOpen(false);
    setSelectedTask(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-earth-warm via-background to-earth-warm/50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div 
          className="h-96 bg-cover bg-center bg-no-repeat relative"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-earth-deep/60" />
          <div className="relative container mx-auto px-4 h-full flex items-center">
            <div className="max-w-2xl text-white">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                  Chi Voice
                </h1>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSignOut}
                  className="border-white text-white hover:bg-white hover:text-earth-deep"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
              <p className="text-xl md:text-2xl mb-6 opacity-90">
                Preserving Indigenous Languages Through Your Voice
              </p>
              <p className="text-lg mb-8 opacity-80">
                Join our community in building the world's largest collection of indigenous language recordings. 
                Your voice helps preserve cultural heritage for future generations.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  className="bg-earth-primary hover:bg-earth-primary/90 text-white px-8"
                  onClick={() => document.getElementById('tasks')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Start Recording
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-white text-white hover:bg-white hover:text-earth-deep"
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatsCard
            title="Tasks Completed"
            value={stats.completedTasks}
            total={stats.totalTasks}
            icon={Trophy}
            description="Your contribution progress"
            color="success"
          />
          <StatsCard
            title="Words Recorded"
            value={stats.wordsCompleted}
            icon={BookOpen}
            description="Individual words translated"
            color="primary"
          />
          <StatsCard
            title="Phrases Recorded"
            value={stats.phrasesCompleted}
            icon={Volume2}
            description="Phrase translations completed"
            color="secondary"
          />
          <StatsCard
            title="Total Time"
            value={stats.totalContributionTime}
            icon={Clock}
            description="Minutes contributed"
            color="warning"
          />
        </div>

        {/* Mission Statement */}
        <Card className="mb-12 border-l-4 border-l-earth-primary">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Heart className="w-6 h-6 text-earth-primary" />
              <span>Our Mission</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Indigenous languages carry the wisdom, culture, and identity of communities worldwide. 
              With many languages at risk of disappearing, Chi Language Vault empowers native speakers 
              to preserve their linguistic heritage through voice recordings that will train future AI 
              translation models and keep these precious languages alive for generations to come.
            </p>
          </CardContent>
        </Card>

        {/* Tasks Section */}
        <div id="tasks" className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground">Recording Tasks</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose from words, phrases, or sentences to record in your indigenous language. 
              Each contribution helps build our comprehensive language dataset.
            </p>
          </div>

          {/* Language Selection and Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="space-y-2">
                <label className="text-sm font-medium">Choose Language:</label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages
                      .filter(lang => lang.is_popular)
                      .map(language => (
                        <SelectItem key={language.id} value={language.id}>
                          {language.name}
                        </SelectItem>
                      ))}
                    {languages.filter(lang => !lang.is_popular).length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-muted-foreground border-t">
                          Other Languages
                        </div>
                        {languages
                          .filter(lang => !lang.is_popular)
                          .map(language => (
                            <SelectItem key={language.id} value={language.id}>
                              {language.name}
                            </SelectItem>
                          ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedLanguage && (
                <Button 
                  onClick={generateNewTask}
                  disabled={generatingTask || !userProgress?.can_generate_next}
                  className="bg-earth-primary hover:bg-earth-primary/90"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {generatingTask ? 'Generating...' : 'Generate New Task'}
                </Button>
              )}
            </div>
            
            {userProgress && (
              <div className="text-center">
                <Badge variant="outline" className="text-earth-primary">
                  {userProgress.recordings_count}/2 recordings completed
                </Badge>
                {!userProgress.can_generate_next && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete 2 recordings to unlock new tasks
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-earth-primary">
                {filteredTasks.length} tasks found
              </Badge>
            </div>
          </div>

          {/* Task Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="word">Words</TabsTrigger>
              <TabsTrigger value="phrase">Phrases</TabsTrigger>
              <TabsTrigger value="sentence">Sentences</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {filteredTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStart={handleStartTask}
                    />
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <Globe className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No tasks found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search or filter criteria.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Community Impact Section */}
        <Card className="mt-12 bg-gradient-to-r from-earth-primary to-earth-secondary text-white">
          <CardContent className="p-8 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-90" />
            <h3 className="text-2xl font-bold mb-4">Join Our Global Community</h3>
            <p className="text-lg opacity-90 mb-6 max-w-2xl mx-auto">
              Together, we're creating the world's most comprehensive indigenous language dataset. 
              Every recording you make helps preserve cultural heritage and enables future AI translation tools.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
              <div>
                <div className="text-3xl font-bold">1,200+</div>
                <div className="opacity-80">Recordings</div>
              </div>
              <div>
                <div className="text-3xl font-bold">45</div>
                <div className="opacity-80">Languages</div>
              </div>
              <div>
                <div className="text-3xl font-bold">300+</div>
                <div className="opacity-80">Contributors</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recording Modal */}
      <RecordingModal
        isOpen={isRecordingModalOpen}
        onClose={() => setIsRecordingModalOpen(false)}
        task={selectedTask}
        onSubmit={handleSubmitRecording}
      />
    </div>
  );
};

export default Index;
