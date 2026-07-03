import { EmptyState } from '@/components/ui/EmptyState/EmptyState'
import { LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export default function AppPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <EmptyState
        icon={<LayoutDashboard className="h-12 w-12" />}
        title="Dashboard đang được phát triển"
        description="Trang dashboard sẽ hiển thị các quiz của bạn, thống kê và hoạt động gần đây."
        action={
          <Link to="/">
            <Button variant="primary">Quay về trang chủ</Button>
          </Link>
        }
      />
    </div>
  )
}
