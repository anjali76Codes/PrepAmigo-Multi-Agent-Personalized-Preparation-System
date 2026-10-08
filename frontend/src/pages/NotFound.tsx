import { Link, useNavigate } from "react-router-dom";
import { Mascot } from "../components/ui/Mascot";
import { Button } from "../components/ui/Button";
import { PageBackground } from "../components/ui/PageBackground";
import { motion } from "framer-motion";

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg relative overflow-hidden text-carbon-700 flex flex-col justify-center items-center px-4 py-16">
      <PageBackground className="fixed inset-0 z-[-1]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg mx-auto text-center flex flex-col items-center z-10"
      >
        <div className="relative mb-6">
          <div className="absolute -inset-4 bg-soft-rose/50 rounded-full blur-2xl -z-10" />
          <Mascot
            variant="Embarassment.png"
            size="xl"
            alt="PrepAmigo Mascot looking embarrassed"
            className="w-48 h-48 sm:w-56 sm:h-56 select-none drop-shadow-md"
          />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-navy-50 text-navy-600 border border-navy-200 text-xs font-semibold tracking-wider uppercase mb-3">
          Error 404
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-carbon-900 tracking-tight mb-3">
          Oops! Page Not Found
        </h1>

        <p className="text-base text-carbon-500 max-w-md mx-auto mb-8 leading-relaxed">
          Amigo couldn&apos;t find the page you were looking for. It might have been moved, renamed, or never existed in the first place.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            className="h-11 px-6 rounded-control text-sm font-semibold"
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>

          <Link to="/">
            <Button
              variant="primary"
              className="h-11 px-6 rounded-control text-sm font-semibold shadow-md"
            >
              Back to Home
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
