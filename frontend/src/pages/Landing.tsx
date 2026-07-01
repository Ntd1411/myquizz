import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import {
  GameController,
  Users,
  ChartLine,
  Lightning,
  DeviceMobile,
  LockKey
} from '@phosphor-icons/react'

export default function LandingPage() {
  const reduce = useReducedMotion()

  const features = [
    {
      icon: Lightning,
      title: 'Real-time Play',
      description: 'Live multiplayer quiz sessions with instant results and leaderboards'
    },
    {
      icon: Users,
      title: 'Easy Collaboration',
      description: 'Share quiz codes, invite players, and track engagement in real time'
    },
    {
      icon: ChartLine,
      title: 'Live Analytics',
      description: 'Monitor player performance and quiz statistics as they happen'
    },
    {
      icon: DeviceMobile,
      title: 'Mobile Ready',
      description: 'Play from any device with responsive design and touch controls'
    },
    {
      icon: LockKey,
      title: 'Secure Sessions',
      description: 'Private quiz sessions with unique codes and host controls'
    },
    {
      icon: GameController,
      title: 'Engaging UI',
      description: 'Modern interface designed for focus and competitive fun'
    }
  ]

  return (
    <div className="min-h-[100dvh]">
      <section className="relative min-h-[100dvh] flex items-center justify-center px-6 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center pt-24">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-center gap-2 mb-6">
              <GameController size={48} weight="duotone" className="text-primary" />
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tighter mb-6 leading-none">
              Real-time quiz platform for engaging learning
            </h1>
            <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Create interactive quizzes, host live sessions, and watch players compete in real time
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register" className="btn-primary text-lg px-8 py-4">
                Get Started
              </Link>
              <Link to="/login" className="btn-secondary text-lg px-8 py-4">
                Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-24 px-6 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Everything you need for interactive quizzes
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Built for educators, trainers, and anyone who wants to make learning interactive
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  initial={reduce ? false : { opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.1,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                  className="card hover:shadow-lg transition-shadow"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon size={24} weight="duotone" className="text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={reduce ? false : { opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-4xl font-semibold tracking-tight mb-6">
                Host live quiz sessions with ease
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                Create a quiz, share the session code, and watch players join in real time.
                Control the flow, see live responses, and reveal the leaderboard after each question.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-success" />
                  </div>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    Generate unique session codes instantly
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-success" />
                  </div>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    Real-time player tracking and scoring
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-success" />
                  </div>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    Automatic leaderboards and final results
                  </span>
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={reduce ? false : { opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                <GameController size={120} weight="duotone" className="text-primary opacity-50" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-zinc-900 dark:bg-zinc-950 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6">
              Ready to get started?
            </h2>
            <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
              Create your first quiz and host a live session in minutes
            </p>
            <Link to="/register" className="btn-primary text-lg px-8 py-4 inline-block">
              Create Free Account
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <GameController size={28} weight="duotone" className="text-primary" />
              <span className="text-lg font-semibold">MyQuizz</span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              © 2026 MyQuizz. Real-time quiz platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
