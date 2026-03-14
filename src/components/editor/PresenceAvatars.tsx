'use client'
import { motion, AnimatePresence } from 'framer-motion'
import type { PresenceUser } from '@/hooks/usePresence'

interface Props {
  users: PresenceUser[]
}

/**
 * Shows small colored avatar chips for each collaborator currently in the document.
 * Renders nothing when the user is alone.
 */
export default function PresenceAvatars({ users }: Props) {
  if (users.length === 0) return null

  return (
    <div className="flex items-center gap-1" title={`${users.length} other${users.length !== 1 ? 's' : ''} viewing`}>
      <AnimatePresence>
        {users.slice(0, 5).map((u) => (
          <motion.div
            key={u.userId}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            title={u.displayName}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#0d0d0f] select-none cursor-default"
            style={{ background: u.avatarColor }}
          >
            {u.displayName.charAt(0).toUpperCase()}
          </motion.div>
        ))}
      </AnimatePresence>
      {users.length > 5 && (
        <span className="text-[10px] text-[#6b6b75] ml-1">+{users.length - 5}</span>
      )}
      <span className="ml-1.5 text-[10px] text-[#4a4a55]">
        {users.length === 1 ? '1 other here' : `${users.length} others here`}
      </span>
    </div>
  )
}
