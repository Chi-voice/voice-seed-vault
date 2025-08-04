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

    // Check if user should work on starter tasks first
    const { data: starterTasks } = await supabase
      .from('tasks')
      .select(`
        id, 
        sequence_order,
        recordings!recordings_task_id_fkey(id, user_id)
      `)
      .eq('language_id', language_id)
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

    // Check if user can generate next task (has completed 2 recordings)
    const { data: progress } = await supabase
      .from('user_task_progress')
      .select('can_generate_next, recordings_count')
      .eq('user_id', user_id)
      .eq('language_id', language_id)
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

    // Get language name
    const { data: language } = await supabase
      .from('languages')
      .select('name')
      .eq('id', language_id)
      .single();

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
      return new Response(JSON.stringify({ error: 'Failed to generate task' }), {
        status: 500,
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
      return new Response(JSON.stringify({ error: 'Invalid response from AI' }), {
        status: 500,
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
        language_id: language_id,
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
      .eq('language_id', language_id);

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