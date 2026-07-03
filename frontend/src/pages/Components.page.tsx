/**
 * Components Showcase Page
 * Demo các core UI components
 */

import {
  Button,
  IconButton,
  Input,
  Textarea,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Badge,
  Avatar,
  Progress,
  Skeleton,
  EmptyState,
  ErrorState,
} from '@/components/ui'
import {
  ArrowLeft,
  ArrowRight,
  X,
  Check,
  AlertTriangle,
  HelpCircle,
  Search,
  Loader2,
  Inbox,
  Wifi,
  WifiOff,
  Zap,
  Plus,
} from 'lucide-react'

export function ComponentsPage() {
  return (
    <div className="min-h-screen bg-bg py-12">
      <div className="container">
        <h1 className="mb-8">Core Components Library</h1>

        {/* Buttons */}
        <section className="mb-16">
          <h2 className="mb-6">Buttons</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-lg">Variants</h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="outline">Outline</Button>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-lg">Sizes</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button size="base">Base</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-lg">States</h3>
              <div className="flex flex-wrap gap-4">
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
                <Button iconLeft={<ArrowLeft size={16} />}>With Icon Left</Button>
                <Button iconRight={<ArrowRight size={16} />}>With Icon Right</Button>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-lg">Icon Buttons</h3>
              <div className="flex flex-wrap gap-4">
                <IconButton icon={<X size={20} />} aria-label="Close" />
                <IconButton icon={<Check size={20} />} aria-label="Check" variant="default" />
                <IconButton icon={<AlertTriangle size={20} />} aria-label="Warning" variant="danger" />
                <IconButton icon={<HelpCircle size={20} />} aria-label="Help" size="lg" />
              </div>
            </div>
          </div>
        </section>

        {/* Inputs */}
        <section className="mb-16">
          <h2 className="mb-6">Form Inputs</h2>
          
          <div className="max-w-xl space-y-6">
            <Input
              label="Email"
              type="email"
              placeholder="Nhập email của bạn"
              hint="Chúng tôi sẽ không chia sẻ email của bạn"
            />
            
            <Input
              label="Password"
              type="password"
              placeholder="Nhập mật khẩu"
              error="Mật khẩu phải có ít nhất 8 ký tự"
            />
            
            <Input
              label="Search"
              placeholder="Tìm kiếm..."
              iconLeft={<Search size={16} />}
            />
            
            <Textarea
              label="Message"
              placeholder="Nhập tin nhắn của bạn..."
              hint="Tối đa 500 ký tự"
              rows={4}
            />
            
            <Input
              label="Disabled Input"
              placeholder="This is disabled"
              disabled
            />
          </div>
        </section>

        {/* Cards */}
        <section className="mb-16">
          <h2 className="mb-6">Cards</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="elevated">
              <CardHeader>
                <h3 className="font-semibold">Elevated Card</h3>
              </CardHeader>
              <CardBody>
                <p className="text-ink-muted">
                  This card has elevation shadow for depth.
                </p>
              </CardBody>
            </Card>

            <Card variant="outlined">
              <CardHeader>
                <h3 className="font-semibold">Outlined Card</h3>
              </CardHeader>
              <CardBody>
                <p className="text-ink-muted">
                  This card has border instead of shadow.
                </p>
              </CardBody>
            </Card>

            <Card variant="elevated" interactive>
              <CardHeader>
                <h3 className="font-semibold">Interactive Card</h3>
              </CardHeader>
              <CardBody>
                <p className="text-ink-muted">
                  Hover me to see the interaction effect.
                </p>
              </CardBody>
              <CardFooter>
                <Button size="sm" variant="secondary">Action</Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Badges */}
        <section className="mb-16">
          <h2 className="mb-6">Badges</h2>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Badge variant="primary">Primary</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="info">Info</Badge>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <Badge size="sm">Small</Badge>
              <Badge size="base">Base</Badge>
              <Badge size="lg">Large</Badge>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <Badge dot variant="success">Online</Badge>
              <Badge dot variant="warning">Away</Badge>
              <Badge dot variant="danger">Busy</Badge>
            </div>
          </div>
        </section>

        {/* Avatars */}
        <section className="mb-16">
          <h2 className="mb-6">Avatars</h2>
          
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar size="sm" fallback="AB" />
              <Avatar size="base" fallback="CD" />
              <Avatar size="lg" fallback="EF" />
              <Avatar size="xl" fallback="GH" />
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <Avatar fallback="ON" status="online" />
              <Avatar fallback="OF" status="offline" />
              <Avatar fallback="AW" status="away" />
              <Avatar fallback="BS" status="busy" />
            </div>
          </div>
        </section>

        {/* Progress */}
        <section className="mb-16">
          <h2 className="mb-6">Progress</h2>
          
          <div className="max-w-xl space-y-6">
            <Progress value={25} showLabel label="Uploading..." />
            <Progress value={50} variant="success" showLabel />
            <Progress value={75} variant="warning" size="lg" />
            <Progress value={90} variant="danger" size="sm" />
          </div>
        </section>

        {/* Skeleton */}
        <section className="mb-16">
          <h2 className="mb-6">Skeleton Loading</h2>
          
          <div className="max-w-xl space-y-4">
            <div className="space-y-2">
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="40%" />
            </div>
            
            <div className="flex items-center gap-4">
              <Skeleton variant="circular" width={48} height={48} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="60%" />
              </div>
            </div>
            
            <Skeleton variant="rectangular" height={200} />
          </div>
        </section>

        {/* Empty State */}
        <section className="mb-16">
          <h2 className="mb-6">Empty State</h2>
          
          <Card>
            <EmptyState
              icon={<Inbox size={64} className="text-ink-subtle" />}
              title="Chưa có dữ liệu"
              description="Bạn chưa có bất kỳ quiz nào. Hãy tạo quiz đầu tiên của bạn!"
              action={<Button iconLeft={<Plus size={16} />}>Tạo Quiz Mới</Button>}
            />
          </Card>
        </section>

        {/* Error State */}
        <section className="mb-16">
          <h2 className="mb-6">Error State</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <ErrorState
                icon={<WifiOff size={64} />}
                title="Lỗi kết nối"
                message="Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và thử lại."
                action={<Button variant="danger" iconLeft={<Loader2 size={16} />}>Thử lại</Button>}
              />
            </Card>
            
            <Card>
              <ErrorState
                icon={<Zap size={64} />}
                variant="warning"
                title="Cảnh báo"
                message="Phiên làm việc của bạn sắp hết hạn. Vui lòng lưu công việc của bạn."
                action={<Button variant="secondary" iconLeft={<Wifi size={16} />}>Gia hạn</Button>}
              />
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}
