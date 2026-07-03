import { motion } from 'framer-motion'
import { Plus, Compass, LogIn, History, Trophy, Target, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth.store'

export default function DashboardPage() {
  const { user } = useAuthStore()
  
  // Mock states - sẽ thay bằng real data từ API
  const isLoading = false
  const hasQuizzes = false
  const hasHistory = false
  
  if (isLoading) {
    return <DashboardSkeleton />
  }

  const isFirstTime = !hasQuizzes && !hasHistory

  return (
    <div className="min-h-screen bg-bg">
      <a href="#main-content" className="skip-link">
        Chuyển đến nội dung chính
      </a>

      <div className="container mx-auto px-4 py-8 max-w-7xl" id="main-content">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-display font-bold text-ink mb-2">
            Xin chào, {user?.fullname || 'bạn'}
          </h1>
          <p className="text-lg text-ink-muted">
            Sẵn sàng cho trận quiz tiếp theo?
          </p>
        </motion.div>

        {isFirstTime ? (
          <FirstTimeExperience />
        ) : (
          <>
            <QuickActions />
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <RecentActivity hasData={hasHistory} />
              <ProgressSummary hasData={hasQuizzes} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function QuickActions() {
  const actions = [
    {
      icon: Plus,
      label: 'Tạo Quiz',
      description: 'Tạo quiz mới cho game session',
      href: '/quiz/create',
      variant: 'primary' as const,
      color: 'primary',
    },
    {
      icon: Compass,
      label: 'Khám phá',
      description: 'Tìm quiz từ cộng đồng',
      href: '/browse',
      variant: 'secondary' as const,
      color: 'accent',
    },
    {
      icon: LogIn,
      label: 'Tham gia phòng',
      description: 'Nhập mã để vào game',
      href: '/join',
      variant: 'secondary' as const,
      color: 'success',
    },
    {
      icon: History,
      label: 'Lịch sử',
      description: 'Xem các trận đã chơi',
      href: '/history',
      variant: 'secondary' as const,
      color: 'info',
    },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mb-12"
    >
      <h2 className="text-2xl font-display font-semibold text-ink mb-6">
        Hành động nhanh
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action, index) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
          >
            <Link to={action.href}>
              <Card
                interactive
                padding="lg"
                className="h-full group border border-border hover:border-primary/50 transition-colors"
              >
                <div
                  className={`w-12 h-12 rounded-lg bg-${action.color}-subtle flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <action.icon className={`h-6 w-6 text-${action.color}`} />
                </div>
                
                <h3 className="text-lg font-semibold text-ink mb-1">
                  {action.label}
                </h3>
                
                <p className="text-sm text-ink-muted">
                  {action.description}
                </p>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function RecentActivity({ hasData }: { hasData: boolean }) {
  if (!hasData) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <h2 className="text-2xl font-display font-semibold text-ink mb-6">
          Hoạt động gần đây
        </h2>
        
        <Card padding="lg">
          <EmptyState
            icon={<History className="h-12 w-12" />}
            title="Chưa có hoạt động"
            description="Các quiz và game bạn tham gia sẽ xuất hiện ở đây"
          />
        </Card>
      </motion.section>
    )
  }

  // Mock data - sẽ thay bằng real API data
  const activities = [
    {
      id: 1,
      type: 'quiz_created',
      title: 'Lịch sử Việt Nam',
      date: '2 giờ trước',
      icon: Plus,
      color: 'primary',
    },
    {
      id: 2,
      type: 'game_played',
      title: 'Địa lý thế giới',
      date: '1 ngày trước',
      score: 850,
      icon: Zap,
      color: 'accent',
    },
    {
      id: 3,
      type: 'game_played',
      title: 'Toán học cơ bản',
      date: '2 ngày trước',
      score: 720,
      icon: Zap,
      color: 'success',
    },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <h2 className="text-2xl font-display font-semibold text-ink mb-6">
        Hoạt động gần đây
      </h2>
      
      <Card padding="lg">
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-4 pb-4 last:pb-0 border-b last:border-b-0 border-border-subtle"
            >
              <div className={`w-10 h-10 rounded-lg bg-${activity.color}-subtle flex items-center justify-center flex-shrink-0`}>
                <activity.icon className={`h-5 w-5 text-${activity.color}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-ink truncate">
                  {activity.title}
                </h3>
                <p className="text-sm text-ink-muted">
                  {activity.date}
                  {activity.score && ` · ${activity.score} điểm`}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <Link to="/history" className="block mt-6">
          <Button variant="ghost" fullWidth>
            Xem tất cả
          </Button>
        </Link>
      </Card>
    </motion.section>
  )
}

function ProgressSummary({ hasData }: { hasData: boolean }) {
  if (!hasData) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        <h2 className="text-2xl font-display font-semibold text-ink mb-6">
          Thành tích
        </h2>
        
        <Card padding="lg">
          <EmptyState
            icon={<Trophy className="h-12 w-12" />}
            title="Chưa có thành tích"
            description="Bắt đầu chơi để xây dựng thành tích của bạn"
          />
        </Card>
      </motion.section>
    )
  }

  // Mock data - sẽ thay bằng real API data
  const stats = [
    {
      label: 'Quiz đã tạo',
      value: '12',
      icon: Plus,
      color: 'primary',
    },
    {
      label: 'Trận đã chơi',
      value: '45',
      icon: Zap,
      color: 'accent',
    },
    {
      label: 'Điểm cao nhất',
      value: '950',
      icon: Trophy,
      color: 'success',
    },
    {
      label: 'Độ chính xác',
      value: '87%',
      icon: Target,
      color: 'info',
    },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 }}
    >
      <h2 className="text-2xl font-display font-semibold text-ink mb-6">
        Thành tích
      </h2>
      
      <Card padding="lg">
        <div className="grid grid-cols-2 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={`w-12 h-12 rounded-lg bg-${stat.color}-subtle flex items-center justify-center mx-auto mb-3`}>
                <stat.icon className={`h-6 w-6 text-${stat.color}`} />
              </div>
              
              <div className="text-3xl font-display font-bold text-ink mb-1">
                {stat.value}
              </div>
              
              <div className="text-sm text-ink-muted">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </motion.section>
  )
}

function FirstTimeExperience() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto"
    >
      <Card padding="lg" className="text-center">
        <div className="w-20 h-20 rounded-full bg-primary-subtle flex items-center justify-center mx-auto mb-6">
          <Zap className="h-10 w-10 text-primary" />
        </div>
        
        <h2 className="text-3xl font-display font-bold text-ink mb-4">
          Chào mừng đến với MyQuizz!
        </h2>
        
        <p className="text-lg text-ink-muted mb-8">
          Bắt đầu hành trình học tập và cạnh tranh của bạn. Tạo quiz đầu tiên hoặc khám phá quiz từ cộng đồng.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/quiz/create">
            <Button size="lg" iconLeft={<Plus className="h-5 w-5" />}>
              Tạo quiz đầu tiên
            </Button>
          </Link>
          
          <Link to="/browse">
            <Button size="lg" variant="outline" iconLeft={<Compass className="h-5 w-5" />}>
              Khám phá quiz
            </Button>
          </Link>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border-subtle">
          <h3 className="text-lg font-semibold text-ink mb-4">
            Bạn cũng có thể
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-success-subtle flex items-center justify-center flex-shrink-0">
                <LogIn className="h-4 w-4 text-success" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-ink mb-1">
                  Tham gia phòng
                </h4>
                <p className="text-sm text-ink-muted">
                  Nhập mã để vào game ngay
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-info-subtle flex items-center justify-center flex-shrink-0">
                <Trophy className="h-4 w-4 text-info" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-ink mb-1">
                  Xây dựng thành tích
                </h4>
                <p className="text-sm text-ink-muted">
                  Cạnh tranh và cải thiện kỹ năng
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-12">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>

        <div className="mb-12">
          <Skeleton className="h-8 w-40 mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} padding="lg">
                <Skeleton className="h-12 w-12 rounded-lg mb-4" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Skeleton className="h-8 w-48 mb-6" />
            <Card padding="lg">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-4 pb-4 border-b border-border-subtle last:border-b-0">
                    <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-40 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div>
            <Skeleton className="h-8 w-40 mb-6" />
            <Card padding="lg">
              <div className="grid grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="text-center">
                    <Skeleton className="h-12 w-12 rounded-lg mx-auto mb-3" />
                    <Skeleton className="h-8 w-16 mx-auto mb-2" />
                    <Skeleton className="h-4 w-24 mx-auto" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
