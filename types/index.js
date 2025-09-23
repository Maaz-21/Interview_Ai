/**
 * @typedef {Object} Feedback
 * @property {string} id
 * @property {string} interviewId
 * @property {number} totalScore
 * @property {Array<{name: string, score: number, comment: string}>} categoryScores
 * @property {string[]} strengths
 * @property {string[]} areasForImprovement
 * @property {string} finalAssessment
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Interview
 * @property {string} id
 * @property {string} role
 * @property {string} level
 * @property {string[]} questions
 * @property {string[]} techstack
 * @property {string} createdAt
 * @property {string} userId
 * @property {string} type
 * @property {boolean} finalized
 */

/**
 * @typedef {Object} CreateFeedbackParams
 * @property {string} interviewId
 * @property {string} userId
 * @property {Array<{role: string, content: string}>} transcript
 * @property {string} [feedbackId]
 */

/**
 * @typedef {Object} User
 * @property {string} name
 * @property {string} email
 * @property {string} id
 */

/**
 * @typedef {Object} InterviewCardProps
 * @property {string} [interviewId]
 * @property {string} [userId]
 * @property {string} role
 * @property {string} type
 * @property {string[]} techstack
 * @property {string} [createdAt]
 */

/**
 * @typedef {Object} AgentProps
 * @property {string} userName
 * @property {string} [userId]
 * @property {string} [interviewId]
 * @property {string} [feedbackId]
 * @property {"generate" | "interview"} type
 * @property {string[]} [questions]
 */

/**
 * @typedef {Object} RouteParams
 * @property {Promise<Record<string, string>>} params
 * @property {Promise<Record<string, string>>} searchParams
 */

/**
 * @typedef {Object} GetFeedbackByInterviewIdParams
 * @property {string} interviewId
 * @property {string} userId
 */

/**
 * @typedef {Object} GetLatestInterviewsParams
 * @property {string} userId
 * @property {number} [limit]
 */

/**
 * @typedef {Object} SignInParams
 * @property {string} email
 * @property {string} idToken
 */

/**
 * @typedef {Object} SignUpParams
 * @property {string} uid
 * @property {string} name
 * @property {string} email
 * @property {string} password
 */

/**
 * @typedef {"sign-in" | "sign-up"} FormType
 */

/**
 * @typedef {Object} InterviewFormProps
 * @property {string} interviewId
 * @property {string} role
 * @property {string} level
 * @property {string} type
 * @property {string[]} techstack
 * @property {number} amount
 */

/**
 * @typedef {Object} TechIconProps
 * @property {string[]} techStack
 */

// Export empty object to make this a module
export {};