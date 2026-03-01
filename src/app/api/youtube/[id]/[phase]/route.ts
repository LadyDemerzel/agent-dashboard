import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const VIDEOS_DIR = path.join(process.env.HOME || '/Users/ittaisvidler', 'tenxsolo/business/content/deliverables/youtube-videos');

function getGatewayConfig(): { url: string; token: string } {
  let url = "http://127.0.0.1:18789";
  let token = "";
  
  const configPath = path.join(process.env.HOME || '/Users/ittaisvidler', '.openclaw', 'openclaw.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.gateway?.port) url = `http://127.0.0.1:${config.gateway.port}`;
      if (config.hooks?.token) token = config.hooks.token;
    } catch {}
  }
  
  return { url, token };
}

/**
 * Spawn an agent via webhook (POST /hooks/agent)
 */
async function spawnAgentViaWebhook(
  agentId: string, 
  task: string, 
  label: string,
  model?: string
): Promise<void> {
  const { url, token } = getGatewayConfig();
  
  if (!token) {
    throw new Error("Hooks token not found in config");
  }
  
  const endpoint = `${url}/hooks/agent`;
  
  const payload = {
    message: task,
    agentId: agentId,
    name: label,
    sessionKey: `hook:youtube:${label}`,
    wakeMode: "now",
    deliver: false,
    model: model || "openrouter/moonshotai/kimi-k2.5",
  };
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook failed: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  console.log("Webhook spawn response:", result);
}

function getVideoData(videoDir: string): Record<string, any> | null {
  const yamlPath = path.join(videoDir, 'video.yaml');
  if (!fs.existsSync(yamlPath)) return null;
  
  const content = fs.readFileSync(yamlPath, 'utf-8');
  const data: Record<string, any> = {};
  
  content.split('\n').forEach(line => {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) data[match[1]] = match[2];
  });
  
  return data;
}

function saveVideoData(videoDir: string, data: Record<string, any>) {
  const yamlPath = path.join(videoDir, 'video.yaml');
  let content = '';
  for (const [key, value] of Object.entries(data)) {
    content += Array.isArray(value) ? `${key}: ${value.join(', ')}\n` : `${key}: ${value}\n`;
  }
  fs.writeFileSync(yamlPath, content);
}

// GET /api/youtube/[id]/[phase] - Trigger workflow phase
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; phase: string }> }
) {
  try {
    const { id, phase } = await params;
    const videoDir = path.join(VIDEOS_DIR, id);
    
    if (!fs.existsSync(videoDir)) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }
    
    const data = getVideoData(videoDir);
    if (!data) {
      return NextResponse.json({ success: false, error: 'Video data not found' }, { status: 404 });
    }
    const topic = data?.topic || data?.title || id;
    
    // Update status based on phase
    const statusMap: Record<string, string> = {
      'research': 'researching',
      'script': 'scripting',
      'images': 'collecting_images',
      'audio': 'generating_audio'
    };
    
    if (statusMap[phase]) {
      data.status = statusMap[phase];
      saveVideoData(videoDir, data);
    }
    
    // Build task prompts
    let task = '';
    let agent = 'echo';
    let label = `youtube-${phase}-${id}`;
    
    switch (phase) {
      case 'research':
        task = `Research "${topic}" for a long-form YouTube video (3+ hours). Write comprehensive, in-depth research covering:
- Complete history and background
- Key concepts explained in detail
- Multiple perspectives and debates
- Real-world applications and examples
- Future implications and trends
- At least 15,000-20,000 words to support a 3 hour video

Save to: ${videoDir}/research.md
Use YAML front matter: title, status: draft, agent: echo, tags: [youtube, research].`;
        agent = 'echo';
        break;
        
      case 'script':
        const researchContent = fs.existsSync(path.join(videoDir, 'research.md')) 
          ? fs.readFileSync(path.join(videoDir, 'research.md'), 'utf-8')
          : '';
        task = `Write a LONG narrator script for a YouTube video based on the research below. This should be a 3+ hour video, so write a very long script (20,000-25,000 words).

Requirements:
- Write in a conversational, engaging storytelling style
- Each section should be 10-15 minutes of narration (~1500-2000 words per section)
- Include natural pauses, transitions, and pacing cues
- Hook at the start, build through middle, call to action at end
- Make it sound like you're talking to a friend, not lecturing
- Include "segment markers" like [SECTION: Topic Name] to help with video editing

Structure:
- Hook (2-3 min): Grab attention with a compelling question or story
- Background (15 min): Set the stage with context
- Main Content (2+ hours): Deep dive into multiple subtopics, each 10-15 min
- Analysis (30 min): Implications, debates, different viewpoints
- Conclusion (10 min): Summary and call to action
- Credits (1 min): Sources, links, thank you

Research to base the script on:
${researchContent}

Save to: ${videoDir}/script.md
Use YAML front matter: title, status: draft, agent: scribe, tags: [youtube, script].`;
        agent = 'scribe';
        break;
        
      case 'images':
        task = `Find and download 150+ high-quality images related to "${topic}" for a long-form YouTube slideshow (3+ hours).

Requirements:
- Save to: ${videoDir}/images/
- Use filenames like: image-001.jpg, image-002.jpg, etc.
- Prioritize public domain/CC images from: Wikipedia Commons, NASA, museums, government sites
- Include: historical photos, diagrams, infographics, relevant imagery for each section
- Organize by category in subfolders if helpful
- Aim for variety: wide shots, close-ups, people, places, concepts`;
        agent = 'echo';
        break;
        
      case 'audio':
        const scriptContent = fs.existsSync(path.join(videoDir, 'script.md'))
          ? fs.readFileSync(path.join(videoDir, 'script.md'), 'utf-8').replace(/^---[\s\S]*?---\n/, '')
          : '';
        task = `Generate an AI voice narration from the script below using ElevenLabs TTS.

Requirements:
- Save to: ${videoDir}/audio/narration.mp3
- Use a natural, engaging voice
- Add natural pauses at section markers
- Ensure audio quality is high (192kbps or better)
- If the script is very long, you may need to generate in parts and concatenate

Script:
${scriptContent}`;
        agent = 'ralph';
        break;
        
      default:
        return NextResponse.json({ success: false, error: 'Invalid phase' }, { status: 400 });
    }
    
    // Spawn via webhook
    await spawnAgentViaWebhook(agent, task, label);
    
    return NextResponse.json({ 
      success: true, 
      message: `${phase} task spawned to ${agent}` 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Also support POST
export { GET as POST };
