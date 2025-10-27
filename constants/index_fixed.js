import { z } from "zod";

export const mappings = {
  "react.js": "react",
  reactjs: "react",
  react: "react",
  "next.js": "nextjs",
  nextjs: "nextjs",
  next: "nextjs",
  "vue.js": "vuejs",
  vuejs: "vuejs",
  vue: "vuejs",
  "express.js": "express",
  expressjs: "express",
  express: "express",
  "node.js": "nodejs",
  nodejs: "nodejs",
  node: "nodejs",
  mongodb: "mongodb",
  mongo: "mongodb",
  mongoose: "mongoose",
  mysql: "mysql",
  postgresql: "postgresql",
  sqlite: "sqlite",
  firebase: "firebase",
  docker: "docker",
  kubernetes: "kubernetes",
  aws: "aws",
  azure: "azure",
  gcp: "gcp",
  digitalocean: "digitalocean",
  heroku: "heroku",
  photoshop: "photoshop",
  "adobe photoshop": "photoshop",
  html5: "html5",
  html: "html5",
  css3: "css3",
  css: "css3",
  sass: "sass",
  scss: "sass",
  less: "less",
  tailwindcss: "tailwindcss",
  tailwind: "tailwindcss",
  bootstrap: "bootstrap",
  jquery: "jquery",
  typescript: "typescript",
  ts: "typescript",
  javascript: "javascript",
  js: "javascript",
  "angular.js": "angular",
  angularjs: "angular",
  angular: "angular",
  "ember.js": "ember",
  emberjs: "ember",
  ember: "ember",
  "backbone.js": "backbone",
  backbonejs: "backbone",
  backbone: "backbone",
  nestjs: "nestjs",
  graphql: "graphql",
  "graph ql": "graphql",
  apollo: "apollo",
  webpack: "webpack",
  babel: "babel",
  "rollup.js": "rollup",
  rollupjs: "rollup",
  rollup: "rollup",
  "parcel.js": "parcel",
  parceljs: "parcel",
  npm: "npm",
  yarn: "yarn",
  git: "git",
  github: "github",
  gitlab: "gitlab",
  bitbucket: "bitbucket",
  figma: "figma",
  prisma: "prisma",
  redux: "redux",
  flux: "flux",
  redis: "redis",
  selenium: "selenium",
  cypress: "cypress",
  jest: "jest",
  mocha: "mocha",
  chai: "chai",
  karma: "karma",
  vuex: "vuex",
  "nuxt.js": "nuxt",
  nuxtjs: "nuxt",
  nuxt: "nuxt",
  strapi: "strapi",
  wordpress: "wordpress",
  contentful: "contentful",
  netlify: "netlify",
  vercel: "vercel",
  "aws amplify": "amplify",
};

// VAPI assistant configuration for complete interview workflow
export const createInterviewAssistant = (userId) => {
  return {
    name: "AI Interview Assistant",
    firstMessage: "Hi! I'm your AI interview assistant. I'll help you practice for your upcoming interview. Are you ready to get started?",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a professional AI interview assistant. Follow this exact workflow:

PHASE 1 - INTRODUCTION & READINESS:
1. Greet the user and ask if they're ready to start their interview preparation
2. Wait for confirmation

PHASE 2 - COLLECT INTERVIEW PARAMETERS:
Once user confirms readiness, collect these 5 details in natural conversation:
- Role: What position are they interviewing for? (e.g., Frontend Developer, Backend Developer, Fullstack Developer, UI/UX Designer, Product Manager)
- Type: Technical or Behavioral interview focus?
- Level: What's their experience level? (Junior, Mid-level, Senior)
- Tech Stack: What technologies should we focus on? (e.g., React, Node.js, Python, etc.)
- Amount: How many questions do they want? (suggest 3-5 for practice)

PHASE 3 - GENERATE QUESTIONS:
Once you have all 5 details, use the generateQuestions tool to create personalized interview questions.

PHASE 4 - CONDUCT INTERVIEW:
After receiving the generated questions, conduct the interview:
- Ask questions one at a time
- Wait for complete answers
- Give brief acknowledgment between questions
- Maintain professional but friendly tone

PHASE 5 - CONCLUSION:
After all questions, thank them and end the interview.

IMPORTANT GUIDELINES:
- Keep responses under 30 words for natural voice conversation
- Be conversational and encouraging
- Ask for one detail at a time, don't rush
- Confirm you have all details before generating questions`
        }
      ],
      tools: [
        {
          type: "apiRequest",
          function: {
            name: "api_request_tool"
          },
          name: "generateQuestions",
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/vapi/generate`,
          method: "POST",
          headers: {
            type: "object",
            properties: {
              "Content-Type": {
                type: "string",
                value: "application/json"
              }
            }
          },
          body: {
            type: "object",
            properties: {
              role: {
                description: "Job role/position they're interviewing for",
                type: "string"
              },
              type: {
                description: "Interview type - Technical or Behavioral",
                type: "string"
              },
              level: {
                description: "Experience level - Junior, Mid, or Senior",
                type: "string"
              },
              techstack: {
                description: "Technologies to focus on (comma-separated)",
                type: "string"
              },
              amount: {
                description: "Number of questions to generate",
                type: "string"
              },
              userid: {
                description: "User ID for saving the interview",
                type: "string",
                value: userId || "voice-user"
              }
            },
            required: [
              "role",
              "type", 
              "level",
              "techstack",
              "amount"
            ]
          }
        }
      ]
    },
    voice: {
      provider: "11labs",
      voiceId: "21m00Tcm4TlvDq8ikWAM"
    },
    endCallMessage: "Thank you for practicing with me today. Good luck with your interview! Have a great day!"
  };
};

// Simple test assistant for debugging
export const createMinimalTestAssistant = () => {
  return {
    name: "Test Interview Assistant",
    firstMessage: "Hi! This is a test interview. I'll ask you 3 quick questions. Are you ready?",
    model: {
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are conducting a simple 3-question interview test.

QUESTIONS TO ASK:
1. Tell me about yourself and your background
2. What's your biggest strength as a developer?
3. Where do you see yourself in 5 years?

PROCESS:
- Ask if they're ready first
- Ask questions one at a time
- Wait for complete answers
- Give brief acknowledgment between questions
- After all 3 questions, thank them and end the call

Keep responses under 25 words. Be natural and conversational.`
        }
      ]
    },
    voice: {
      provider: "11labs",
      voiceId: "21m00Tcm4TlvDq8ikWAM"
    },
    endCallMessage: "Great! That completes our test interview. Thanks for trying it out!"
  };
};

export const feedbackSchema = z.object({
  totalScore: z.number(),
  categoryScores: z.tuple([
    z.object({
      name: z.literal("Communication Skills"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Technical Knowledge"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Problem Solving"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Cultural Fit"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Confidence and Clarity"),
      score: z.number(),
      comment: z.string(),
    }),
  ]),
  strengths: z.array(z.string()),
  areasForImprovement: z.array(z.string()),
  finalAssessment: z.string(),
});

export const interviewCovers = [
  "/covers/adobe.png",
  "/covers/amazon.png",
  "/covers/facebook.png",
  "/covers/hostinger.png",
  "/covers/pinterest.png",
  "/covers/quora.png",
  "/covers/reddit.png",
  "/covers/skype.png",
  "/covers/spotify.png",
  "/covers/telegram.png",
  "/covers/tiktok.png",
  "/covers/yahoo.png",
];

export const dummyInterviews = [
  {
    id: "interview_1",
    role: "Frontend Developer",
    type: "Technical",
    level: "Mid",
    techstack: ["React", "JavaScript", "HTML", "CSS"],
    questions: [
      "Explain the Virtual DOM and how React uses it for efficient rendering.",
      "What are React Hooks and why were they introduced?",
      "How would you optimize a React application for better performance?",
      "Describe the difference between controlled and uncontrolled components.",
      "Explain the concept of state management in React applications.",
    ],
    createdAt: "2024-12-20T10:30:00Z",
    finalized: true,
    coverImage: "/covers/facebook.png",
  },
  {
    id: "interview_2",
    role: "Backend Developer",
    type: "Technical",
    level: "Senior",
    techstack: ["Node.js", "Express", "MongoDB", "JavaScript"],
    questions: [
      "How would you design a scalable REST API architecture?",
      "Explain the difference between SQL and NoSQL databases with examples.",
      "What is middleware in Express.js and how would you implement custom middleware?",
      "How do you handle authentication and authorization in a Node.js application?",
      "Describe strategies for optimizing database queries and preventing SQL injection.",
    ],
    createdAt: "2024-12-19T14:15:00Z",
    finalized: true,
    coverImage: "/covers/amazon.png",
  },
];