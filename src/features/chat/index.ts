/**
 * ============================================
 * 💬 Chat Feature Module
 * ============================================
 * Centralized exports for all chat-related components and services
 * 
 * Note: Components remain in their original locations for now
 * to avoid breaking imports. This barrel export provides a 
 * unified import path for the chat feature.
 */

// Components (re-exported from original locations)
export { default as ChatWidget } from '../../components/ChatWidget';
export { default as RealtimeChatWidget } from '../../components/RealtimeChatWidget';

// Services (re-exported from original locations)
export * from '../../services/chatService';
export * from '../../services/realtimeChatService';

