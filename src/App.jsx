import { FONT } from './constants';
import Atmosphere from './components/Atmosphere';
import Navbar from './components/nav/Navbar';
import Hero from './components/Hero';
import Problem from './components/Problem';
import LoopSection from './components/LoopSection';
import DemoSection from './components/demo/DemoSection';
import Architecture from './components/Architecture';
import Stack from './components/Stack';
import Pitch from './components/Pitch';
import CTA from './components/CTA';
import Footer from './components/Footer';

/**
 * App — root component composing all page sections.
 */
export default function App() {
  return (
    <div
      className="relative w-full min-h-screen grain"
      style={{ fontFamily: FONT, background: '#060606', color: '#fff' }}
    >
      <Atmosphere />
      <Navbar />
      <main className="relative">
        <Hero />
        <Problem />
        <LoopSection />
        <DemoSection />
        <Architecture />
        <Stack />
        <Pitch />
        <CTA />
        <Footer />
      </main>
    </div>
  );
}
