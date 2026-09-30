import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messages: [{ role: String, content: String }],
    reply: String,
    provider: String,
    model: String,
    fallbacks: [{ provider: String, error: String }],
  },
  { timestamps: true }
);

chatSchema.index({ userId: 1, createdAt: -1 });

const ChatHistory = mongoose.models.ChatHistory || mongoose.model('ChatHistory', chatSchema);
export default ChatHistory;
