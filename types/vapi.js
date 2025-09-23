/**
 * Message Type Enumeration
 * @readonly
 * @enum {string}
 */
export const MessageTypeEnum = {
  TRANSCRIPT: "transcript",
  FUNCTION_CALL: "function-call",
  FUNCTION_CALL_RESULT: "function-call-result",
  ADD_MESSAGE: "add-message",
};

/**
 * Message Role Enumeration
 * @readonly
 * @enum {string}
 */
export const MessageRoleEnum = {
  USER: "user",
  SYSTEM: "system",
  ASSISTANT: "assistant",
};

/**
 * Transcript Message Type Enumeration
 * @readonly
 * @enum {string}
 */
export const TranscriptMessageTypeEnum = {
  PARTIAL: "partial",
  FINAL: "final",
};

/**
 * @typedef {Object} BaseMessage
 * @property {string} type - Message type from MessageTypeEnum
 */

/**
 * @typedef {Object} TranscriptMessage
 * @property {"transcript"} type - Must be MessageTypeEnum.TRANSCRIPT
 * @property {string} role - Role from MessageRoleEnum
 * @property {string} transcriptType - Type from TranscriptMessageTypeEnum
 * @property {string} transcript - The transcript content
 */

/**
 * @typedef {Object} FunctionCallMessage
 * @property {"function-call"} type - Must be MessageTypeEnum.FUNCTION_CALL
 * @property {Object} functionCall
 * @property {string} functionCall.name - Function name
 * @property {unknown} functionCall.parameters - Function parameters
 */

/**
 * @typedef {Object} FunctionCallResultMessage
 * @property {"function-call-result"} type - Must be MessageTypeEnum.FUNCTION_CALL_RESULT
 * @property {Object} functionCallResult
 * @property {boolean} [functionCallResult.forwardToClientEnabled] - Optional forwarding flag
 * @property {unknown} functionCallResult.result - Function result
 */

/**
 * Union type for all possible message types
 * @typedef {TranscriptMessage | FunctionCallMessage | FunctionCallResultMessage} Message
 */