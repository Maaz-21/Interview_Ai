import Vapi from '@vapi-ai/web'

// Validate required environment variables
if (!process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN) {
  console.error('Missing NEXT_PUBLIC_VAPI_WEB_TOKEN in environment variables');
}

// Initialize VAPI client with public API key
export const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN);

// Add debugging to catch more detailed errors
vapi.on('error', (error) => {
  console.error('VAPI SDK Error:', error);
});
