import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  Users, 
  Globe, 
  Search,
  Heart,
  Sparkles,
  MessageCircle,
  Languages
} from 'lucide-react';
import heroImage from '@/assets/hero-image.jpg';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Language {
  id: string;
  name: string;
  code: string;
  is_popular: boolean;
  total_tasks?: number;
  total_recordings?: number;
}


// Import Glottolog language data
import glottologLanguages from '@/data/glottolog-subset.json';

interface GlottologLanguage {
  id: string;
  name: string;
  family: string;
  latitude?: number;
  longitude?: number;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [generatingTask, setGeneratingTask] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Set up auth state listener
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (!user) {
        navigate('/auth');
      }
    });
  }, [navigate]);

  // Load languages
  useEffect(() => {
    if (user) {
      loadLanguages();
    }
  }, [user]);

  const loadLanguages = async () => {
    try {
      const { data, error } = await supabase
        .from('languages')
        .select('*')
        .order('is_popular', { ascending: false })
        .order('name');
      
      if (error) throw error;
      
      setLanguages(data || []);
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

  const startLanguageChat = async (languageId: string) => {
    if (!user) return;

    // Generate initial task for the language
    setGeneratingTask(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-task', {
        body: {
          language_id: languageId,
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

      // Navigate to chat
      navigate(`/chat/${languageId}`);
    } catch (error: any) {
      toast({
        title: "Error starting chat",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingTask(false);
    }
  };

  // Filter languages based on search - combine DB languages with Glottolog
  const glottologFormatted = glottologLanguages.map(lang => ({
    ...lang,
    code: lang.id, // Use glottolog ID as code
    region: lang.family || 'Unknown',
    is_popular: false,
    total_tasks: 0,
    total_recordings: 0
  }));
  
  type CombinedLanguage = Language | typeof glottologFormatted[0];
  
  const allLanguages: CombinedLanguage[] = [...languages, ...glottologFormatted];
  const filteredLanguages = allLanguages
    .filter((language: CombinedLanguage) =>
      language.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      language.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ('family' in language && language.family?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .slice(0, 20);


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

  return (
    <div className="min-h-screen bg-gradient-to-br from-earth-warm via-background to-earth-warm/50 pb-20">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div 
          className="h-96 bg-cover bg-center bg-no-repeat relative"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-earth-deep/60" />
          <div className="relative container mx-auto px-4 h-full flex items-center">
            <div className="max-w-2xl text-white">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-4">
                Chi Voice
              </h1>
              <p className="text-xl md:text-2xl mb-6 opacity-90">
                Preserving Indigenous Languages Through Your Voice
              </p>
              <p className="text-lg mb-8 opacity-80">
                Join our community in building the world's largest collection of indigenous language recordings. 
                Your voice helps preserve cultural heritage for future generations.
              </p>
              <Button 
                size="lg" 
                className="bg-earth-primary hover:bg-earth-primary/90 text-white px-8"
                onClick={() => document.getElementById('languages')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Mic className="w-5 h-5 mr-2" />
                Start Recording
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mission Statement */}
      <div className="container mx-auto px-4 py-12">
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
              With many languages at risk of disappearing, Chi Voice empowers native speakers 
              to preserve their linguistic heritage through voice recordings that will train future AI 
              translation models and keep these precious languages alive for generations to come.
            </p>
          </CardContent>
        </Card>

        {/* Language Selection */}
        <div id="languages" className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground">Choose Your Language</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Select an indigenous language to start your recording journey. Each contribution helps preserve cultural heritage.
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search languages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Language Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLanguages.map((language, index) => {
              const isDbLanguage = 'total_tasks' in language;
              const key = language.id || `${language.code}-${index}`;
              
              return (
                <Card 
                  key={key}
                  className="cursor-pointer hover:shadow-lg transition-shadow group"
                  onClick={() => {
                    if (isDbLanguage) {
                      startLanguageChat(language.id);
                    } else {
                      toast({
                        title: "Language not available",
                        description: "This language is not yet available for recording.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg group-hover:text-earth-primary transition-colors">
                          {language.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {language.code} • {isDbLanguage ? 'Global' : ('family' in language ? String(language.family) : 'Unknown')}
                        </p>
                        {isDbLanguage && 'total_tasks' in language && language.total_tasks && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {language.total_tasks} tasks available
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {isDbLanguage && 'is_popular' in language && language.is_popular && (
                          <Badge variant="default" className="bg-earth-primary">
                            Popular
                          </Badge>
                        )}
                        <Languages className="w-5 h-5 text-muted-foreground group-hover:text-earth-primary transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredLanguages.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <Globe className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No languages found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search criteria.
                </p>
              </CardContent>
            </Card>
          )}
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
    </div>
  );
};

export default Index;
