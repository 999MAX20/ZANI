import { Link } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, ShieldCheck } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../auth/AuthProvider";

export function NotFoundPage() {
  const { isPlatformUser, isMerchantUser, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const homePath = isPlatformUser ? "/platform" : isMerchantUser ? "/dashboard" : "/";

  return (
    <main className="min-h-screen bg-soft-mesh p-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-3xl items-center justify-center">
        <Card className="w-full">
          <CardBody className="p-8 text-center sm:p-10">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-ai-gradient text-white shadow-glow">
              <ShieldCheck size={30} />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-brand-700">{t("notFound.eyebrow")}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-midnight sm:text-4xl">{t("notFound.title")}</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600">
              {t("notFound.text")}
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to={homePath}>
                <Button variant="ai"><LayoutDashboard size={17} />{t("notFound.backWorkspace")}</Button>
              </Link>
              {isAuthenticated ? null : (
                <Link to="/login">
                  <Button variant="secondary"><ArrowLeft size={17} />{t("auth.submit")}</Button>
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
