import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Clock
} from 'lucide-react';
import heroImage from '@/assets/hero-image.jpg';
import { useToast } from '@/hooks/use-toast';

// Sample tasks data - in a real app, this would come from a backend
const sampleTasks: Task[] = [
  {
    id: '1',
    type: 'word',
    englishText: 'Hello',
    description: 'A common greeting used when meeting someone',
    difficulty: 'beginner',
    estimatedTime: 2,
    isCompleted: false
  },
  {
    id: '2', 
    type: 'phrase',
    englishText: 'How are you?',
    description: 'A polite question asking about someone\'s wellbeing',
    difficulty: 'beginner',
    estimatedTime: 3,
    isCompleted: true
  },
  {
    id: '3',
    type: 'sentence',
    englishText: 'The sun rises in the east and sets in the west.',
    description: 'A statement about natural phenomena',
    difficulty: 'intermediate',
    estimatedTime: 5,
    isCompleted: false
  },
  {
    id: '4',
    type: 'word',
    englishText: 'Family',
    description: 'People who are related to you',
    difficulty: 'beginner',
    estimatedTime: 2,
    isCompleted: false
  },
  {
    id: '5',
    type: 'phrase',
    englishText: 'Thank you very much',
    description: 'An expression of deep gratitude',
    difficulty: 'intermediate',
    estimatedTime: 3,
    isCompleted: false
  }
];

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>(sampleTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();

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

  const handleStartTask = (task: Task) => {
    setSelectedTask(task);
    setIsRecordingModalOpen(true);
  };

  const handleSubmitRecording = async (taskId: string, audioBlob: Blob, notes?: string) => {
    // In a real app, this would upload to a backend/database
    console.log('Submitting recording for task:', taskId, audioBlob, notes);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mark task as completed
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, isCompleted: true } : task
    ));
    
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
              <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
                Chi Language Vault
              </h1>
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
