export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-display font-bold text-primary">404</h1>
        <p className="text-xl text-ink-muted">Không tìm thấy trang</p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition"
        >
          Về trang chủ
        </a>
      </div>
    </div>
  )
}
