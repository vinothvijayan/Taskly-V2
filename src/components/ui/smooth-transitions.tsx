import { motion, AnimatePresence } from "framer-motion"
import { ReactNode } from "react"

interface AnimatedContainerProps {
  children: ReactNode
  className?: string
}

export const AnimatedContainer = ({ children, className }: AnimatedContainerProps) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

interface StaggeredListProps {
  children: ReactNode
  className?: string
}

export const StaggeredList = ({ children, className }: StaggeredListProps) => {
  const listVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  }

  return (
    <motion.div
      className={className}
      variants={listVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence>
        {children}
      </AnimatePresence>
    </motion.div>
  )
}