export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md auth-form">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Ojakh</h1>
          <p className="text-muted-foreground mt-2" style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}>
            Домашние полуфабрикаты, торты и десерты
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
