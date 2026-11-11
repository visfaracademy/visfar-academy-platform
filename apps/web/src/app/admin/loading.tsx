// Loading state cho /admin/* (Task 09 phan 1/4).
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite">
      <h1 className="gold-title">Tổng quan quản trị</h1>
      <p>Đang tải dữ liệu tổng quan…</p>
    </div>
  );
}
