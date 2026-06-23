export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-black leading-tight text-midnight sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm font-semibold leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">{actions}</div> : null}
    </div>
  );
}
