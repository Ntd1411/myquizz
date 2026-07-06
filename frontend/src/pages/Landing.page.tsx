import { motion } from 'framer-motion'
import { Button } from '@/components/ui'
import { 
  Sparkles, 
  Zap, 
  Users, 
  Trophy, 
  PlayCircle,
  ArrowRight,
  CheckCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg">
      <a href="#main-content" className="skip-link">
        Chuyển đến nội dung chính
      </a>
      
      {/* Hero Section */}
      <section className="relative overflow-hidden" id="main-content">
        <div className="container py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-subtle border border-primary-border rounded-full mb-6">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  Nền tảng quiz thời gian thực
                </span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-display font-bold mb-6">
                Học tập qua{' '}
                <span className="text-primary">thi đấu</span>
                <br />
                Cạnh tranh để{' '}
                <span className="text-accent">tiến bộ</span>
              </h1>

              <p className="text-xl text-ink-muted mb-8 max-w-2xl mx-auto">
                Tạo và chơi quiz thời gian thực với bạn bè. 
                Trải nghiệm học tập đầy hứng khởi với leaderboard, 
                feedback tức thì và không gian thi đấu sống động.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register">
                  <Button size="lg" iconRight={<PlayCircle className="h-5 w-5" />}>
                    Bắt đầu ngay
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline">
                    Đăng nhập
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Background Gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary-subtle/30 to-transparent pointer-events-none" />
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-surface">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-display font-bold mb-4">
              Cách hoạt động
            </h2>
            <p className="text-xl text-ink-muted max-w-2xl mx-auto">
              Ba bước đơn giản để bắt đầu trải nghiệm học tập tương tác
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: <Zap className="h-8 w-8" />,
                step: '1',
                title: 'Tạo Quiz',
                description: 'Tạo quiz với giao diện trực quan. Thêm câu hỏi, đáp án và thời gian. Chỉ mất vài phút.',
              },
              {
                icon: <Users className="h-8 w-8" />,
                step: '2',
                title: 'Mời Bạn Bè',
                description: 'Chia sẻ mã phòng để bạn bè tham gia. Không cần đăng ký. Chơi ngay trên mọi thiết bị.',
              },
              {
                icon: <Trophy className="h-8 w-8" />,
                step: '3',
                title: 'Thi Đấu',
                description: 'Trả lời câu hỏi theo thời gian thực. Xem điểm số trực tiếp. Leo lên top leaderboard.',
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="relative p-8 bg-bg rounded-2xl border border-border hover:border-primary-border transition-colors">
                  <div className="absolute -top-4 left-8 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {step.step}
                  </div>
                  
                  <div className="text-primary mb-4">
                    {step.icon}
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-3">
                    {step.title}
                  </h3>
                  
                  <p className="text-ink-muted">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* For Players Section */}
      <section className="py-20">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-success-subtle border border-success-border rounded-full mb-4">
                <PlayCircle className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">
                  Dành cho người chơi
                </span>
              </div>

              <h2 className="text-4xl font-display font-bold mb-6">
                Học tập không còn nhàm chán
              </h2>

              <p className="text-lg text-ink-muted mb-8">
                Tham gia game quiz thời gian thực, cạnh tranh với bạn bè, 
                leo lên leaderboard và theo dõi tiến trình của bạn.
              </p>

              <ul className="space-y-4 mb-8">
                {[
                  'Tham gia không cần đăng ký',
                  'Chơi trên mọi thiết bị',
                  'Feedback tức thì khi trả lời',
                  'Xem vị trí real-time trên bảng xếp hạng',
                  'Theo dõi tiến trình và thành tích',
                ].map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success shrink-0" />
                    <span className="text-ink">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link to="/game/join">
                <Button size="lg" iconRight={<ArrowRight className="h-5 w-5" />}>
                  Tham gia game
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="aspect-square bg-gradient-to-br from-primary-subtle to-accent-subtle rounded-3xl flex items-center justify-center">
                <div className="text-center p-8">
                  <Trophy className="h-24 w-24 text-primary mx-auto mb-4" />
                  <p className="text-lg font-semibold text-ink">
                    Trải nghiệm thi đấu sống động
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* For Creators Section */}
      <section className="py-20 bg-surface">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 lg:order-1 relative"
            >
              <div className="aspect-square bg-gradient-to-br from-accent-subtle to-primary-subtle rounded-3xl flex items-center justify-center">
                <div className="text-center p-8">
                  <Zap className="h-24 w-24 text-accent mx-auto mb-4" />
                  <p className="text-lg font-semibold text-ink">
                    Tạo quiz trong vài phút
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 lg:order-2"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-subtle border border-accent-border rounded-full mb-4">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-accent">
                  Dành cho người tạo quiz
                </span>
              </div>

              <h2 className="text-4xl font-display font-bold mb-6">
                Tạo quiz nhanh chóng và dễ dàng
              </h2>

              <p className="text-lg text-ink-muted mb-8">
                Giao diện trực quan giúp bạn tạo quiz chuyên nghiệp trong vài phút. 
                Chia sẻ với học sinh, đồng nghiệp hoặc bạn bè.
              </p>

              <ul className="space-y-4 mb-8">
                {[
                  'Tạo quiz với nhiều loại câu hỏi',
                  'Tùy chỉnh thời gian cho mỗi câu',
                  'Xem analytics và kết quả chi tiết',
                  'Chia sẻ quiz dễ dàng với mã phòng',
                  'Quản lý quiz library của bạn',
                ].map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-accent shrink-0" />
                    <span className="text-ink">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link to="/quiz/create">
                <Button size="lg" variant="secondary" iconRight={<ArrowRight className="h-5 w-5" />}>
                  Tạo quiz đầu tiên
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary to-primary-hover rounded-3xl p-12 text-white"
          >
            <h2 className="text-4xl font-display font-bold mb-4">
              Sẵn sàng bắt đầu?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Tham gia hàng nghìn người đang học tập và cạnh tranh trên MyQuizz
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button 
                  size="lg" 
                  className="bg-white text-primary hover:bg-surface"
                  iconRight={<PlayCircle className="h-5 w-5" />}
                >
                  Bắt đầu miễn phí
                </Button>
              </Link>
              <Link to="/login">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  Đăng nhập
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-surface">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-display text-xl font-bold text-primary mb-4">
                MyQuizz
              </h3>
              <p className="text-sm text-ink-muted">
                Nền tảng quiz thời gian thực để học tập và cạnh tranh
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Sản phẩm</h4>
              <ul className="space-y-2 text-sm text-ink-muted">
                <li><Link to="/quiz/create" className="hover:text-ink">Tạo Quiz</Link></li>
                <li><Link to="/game/join" className="hover:text-ink">Chơi Game</Link></li>
                <li><Link to="/explore" className="hover:text-ink">Khám phá Quiz</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Công ty</h4>
              <ul className="space-y-2 text-sm text-ink-muted">
                <li><Link to="/about" className="hover:text-ink">Về chúng tôi</Link></li>
                <li><Link to="/contact" className="hover:text-ink">Liên hệ</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Pháp lý</h4>
              <ul className="space-y-2 text-sm text-ink-muted">
                <li><Link to="/privacy" className="hover:text-ink">Chính sách bảo mật</Link></li>
                <li><Link to="/terms" className="hover:text-ink">Điều khoản sử dụng</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border text-center text-sm text-ink-muted">
            © 2026 MyQuizz. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
