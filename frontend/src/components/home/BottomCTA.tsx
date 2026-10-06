import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Mascot } from '../ui/Mascot';

export function BottomCTA() {
    return (
        <section className="relative z-10 px-6 py-32 bg-bg">
            <motion.div
                initial={{ y: 150, scale: 0.8, opacity: 0 }}
                whileInView={{ y: 0, scale: 1, opacity: 1 }}
                viewport={{ once: false, margin: "-100px" }}
                transition={{
                    type: "spring",
                    stiffness: 100,
                    damping: 20,
                    mass: 1
                }}
                className="mx-auto max-w-6xl rounded-[3rem] bg-navy-900 px-8 py-24 text-center text-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
            >
                <h2 className="mb-6 text-5xl font-extrabold tracking-tight md:text-6xl text-white">
                    Tell PrepAmigo
                    <Mascot size='lg' variant={"OK.png"} /><br />
                    <span className="text-chrome-accent">where you want to go.</span>
                </h2>
                <p className="mx-auto mb-12 max-w-2xl text-xl text-navy-100 md:text-2xl">
                    It figures out what you need to learn next.
                </p>
                <div className="flex justify-center">
                    <Link to="/signup">
                        <Button
                            variant="primary"
                            size="lg"
                            className="group relative overflow-hidden rounded-full bg-chrome-accent px-10 py-5 text-lg font-bold text-navy-900 transition-transform hover:scale-105 hover:bg-white"
                        >
                            <span className="relative z-10">Create your account</span>
                            <div className="absolute inset-0 z-0 h-full w-full bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </section>
    );
}
