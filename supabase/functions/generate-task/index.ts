import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { language_id, user_id } = await req.json();

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, we need to resolve the language to get the correct database ID
    let languageDbId = language_id;
    
    // Try to find language by UUID first
    let { data: langCheck } = await supabase
      .from('languages')
      .select('id, name, code')
      .eq('id', language_id)
      .maybeSingle();

    // If not found by UUID, try to find by code (Glottolog ID)
    if (!langCheck) {
      const { data: codeData } = await supabase
        .from('languages')
        .select('id, name, code')
        .eq('code', language_id)
        .maybeSingle();
      
      if (codeData) {
        langCheck = codeData;
        languageDbId = codeData.id;
      }
    }

    // Check if user should work on starter tasks first
    const { data: starterTasks } = await supabase
      .from('tasks')
      .select(`
        id, 
        sequence_order,
        recordings!recordings_task_id_fkey(id, user_id)
      `)
      .eq('language_id', languageDbId)
      .eq('is_starter_task', true)
      .order('sequence_order');

    // Find the next uncompleted starter task
    const nextStarterTask = starterTasks?.find(task => 
      !task.recordings?.some((r: any) => r.user_id === user_id)
    );

    if (nextStarterTask) {
      return new Response(JSON.stringify({ 
        error: 'Please complete the starter tasks first',
        nextStarterTask: nextStarterTask.id,
        message: 'You should complete the standardized starter tasks before generating new ones'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there are any existing tasks for this language
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('language_id', languageDbId);

    // If no tasks exist, create a starter task
    if (!taskCount || taskCount === 0) {
      console.log('No tasks found for language, creating starter task');
      // Continue to task generation without checking progress
    } else {
      // Check if user can generate next task (has completed 2 recordings)
      const { data: progress } = await supabase
        .from('user_task_progress')
        .select('can_generate_next, recordings_count')
        .eq('user_id', user_id)
        .eq('language_id', languageDbId)
        .single();

      if (!progress || !progress.can_generate_next) {
        return new Response(JSON.stringify({ 
          error: 'You need to complete 2 recordings before generating next task',
          recordings_needed: 2 - (progress?.recordings_count || 0)
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get language name - try multiple approaches
    let { data: language } = await supabase
      .from('languages')
      .select('id, name, code')
      .eq('id', languageDbId)
      .maybeSingle();

    // If not found by UUID, try to find by code (Glottolog ID)
    if (!language) {
      const { data: codeData } = await supabase
        .from('languages')
        .select('id, name, code')
        .eq('code', language_id)
        .maybeSingle();
      
      language = codeData;
    }

    // If still not found, this might be a Glottolog ID - create the language
    if (!language) {
      console.log('Language not found in database, attempting to load from Glottolog data');
      
      // For edge functions, we need to fetch and parse Glottolog data manually
      try {
        const csvResponse = await fetch('https://d6d1e450-66f8-4d07-a9a9-dff8436e7aad.lovableproject.com/glottolog-full.csv');
        if (csvResponse.ok) {
          const csvText = await csvResponse.text();
          const lines = csvText.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            if (values[0] === language_id) { // Assuming first column is ID
              const languageName = values[1] || 'Unknown Language'; // Assuming second column is name
              
              // Create the language in database
              const { data: newLang, error: createError } = await supabase
                .from('languages')
                .insert({
                  name: languageName,
                  code: language_id,
                  is_popular: false
                })
                .select('id, name, code')
                .single();
              
              if (!createError) {
                language = newLang;
                console.log('Created new language:', languageName);
                break;
              }
            }
          }
        }
      } catch (e) {
        console.error('Error loading Glottolog data:', e);
      }
    }

    if (!language) {
      return new Response(JSON.stringify({ error: 'Language not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate AI prompt using OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const taskTypes = ['word', 'phrase', 'sentence'];
    const difficulties = ['beginner', 'intermediate', 'advanced'];
    const randomType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
    const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];

    const prompt = `Generate a ${randomDifficulty} level English ${randomType} for indigenous language translation practice for ${language.name}. 
    
    Return ONLY a JSON object with these fields:
    - english_text: the English text to translate
    - description: a brief, helpful description of what this means or when it's used
    - estimated_time: estimated minutes to record (1-5)
    
    Keep it culturally appropriate and useful for language preservation. For words, use common vocabulary. For phrases, use everyday expressions. For sentences, use practical statements.`;

    console.log('Generating task with OpenAI for language:', language.name);

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert in language learning and indigenous language preservation. Return only valid JSON objects.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 200,
      }),
    });

    if (!openAIResponse.ok) {
      console.error('OpenAI API error:', openAIResponse.status);

      // Fallback: create a simple deterministic starter task without OpenAI
      const fallbackMap = {
        word: {
          text: 'hello',
          description: `Translate the common greeting "hello" into ${language.name}.`,
          estimated: 1
        },
        phrase: {
          text: 'How are you?',
          description: `Translate this everyday phrase into ${language.name}.`,
          estimated: 2
        },
        sentence: {
          text: 'My name is ____.',
          description: `Translate and say this simple self-introduction in ${language.name}.`,
          estimated: 2
        }
      } as const;

      const f = fallbackMap[randomType as 'word' | 'phrase' | 'sentence'];

      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          english_text: f.text,
          description: f.description,
          type: randomType,
          difficulty: randomDifficulty,
          language_id: language.id,
          estimated_time: f.estimated,
          created_by_ai: false,
          is_starter_task: !taskCount || taskCount === 0
        })
        .select()
        .single();

      if (taskError) {
        console.error('Database error (fallback):', taskError);
        return new Response(JSON.stringify({ error: 'Failed to save task' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('user_task_progress')
        .update({
          recordings_count: 0,
          can_generate_next: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user_id)
        .eq('language_id', language.id);

      console.log('Task generated via fallback successfully:', newTask.id);

      return new Response(JSON.stringify({ task: newTask, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openAIData = await openAIResponse.json();
    const generatedContent = openAIData.choices[0].message.content;
    
    console.log('Generated content:', generatedContent);

    let taskData;
    try {
      taskData = JSON.parse(generatedContent);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', e);

      // Fallback: create a simple deterministic task if AI output is invalid
      const fallbackMap = {
        word: {
          text: 'hello',
          description: `Translate the common greeting "hello" into ${language.name}.`,
          estimated: 1
        },
        phrase: {
          text: 'How are you?',
          description: `Translate this everyday phrase into ${language.name}.`,
          estimated: 2
        },
        sentence: {
          text: 'My name is ____.',
          description: `Translate and say this simple self-introduction in ${language.name}.`,
          estimated: 2
        }
      } as const;

      const f = fallbackMap[randomType as 'word' | 'phrase' | 'sentence'];

      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          english_text: f.text,
          description: f.description,
          type: randomType,
          difficulty: randomDifficulty,
          language_id: language.id,
          estimated_time: f.estimated,
          created_by_ai: false,
          is_starter_task: !taskCount || taskCount === 0
        })
        .select()
        .single();

      if (taskError) {
        console.error('Database error (fallback-parse):', taskError);
        return new Response(JSON.stringify({ error: 'Failed to save task' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('user_task_progress')
        .update({
          recordings_count: 0,
          can_generate_next: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user_id)
        .eq('language_id', language.id);

      console.log('Task generated via fallback (parse) successfully:', newTask.id);

      return new Response(JSON.stringify({ task: newTask, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create the task in database
    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        english_text: taskData.english_text,
        description: taskData.description,
        type: randomType,
        difficulty: randomDifficulty,
        language_id: language.id, // Use the actual database language ID
        estimated_time: taskData.estimated_time || 2,
        created_by_ai: true
      })
      .select()
      .single();

    if (taskError) {
      console.error('Database error:', taskError);
      return new Response(JSON.stringify({ error: 'Failed to save task' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reset user's progress so they need 2 more recordings for next task
    await supabase
      .from('user_task_progress')
      .update({ 
        recordings_count: 0, 
        can_generate_next: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .eq('language_id', language.id); // Use the actual database language ID

    console.log('Task generated successfully:', newTask.id);

    return new Response(JSON.stringify({ task: newTask }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});