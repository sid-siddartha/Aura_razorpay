"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "../components/ui/button";
import Link from "next/link";

const HeroSection = () => {
  const imageRef = useRef(null);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const buttonsRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger animations on load
    setIsLoaded(true);

    const imageElement = imageRef.current;

    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const scrollThreshold = 100;

      // Parallax effect - image moves slower than scroll
      if (imageElement) {
        imageElement.style.transform = `translateY(${scrollPosition * 0.5}px)`;
      }

      if (scrollPosition > scrollThreshold) {
        imageElement?.classList.add("scrolled");
      } else {
        imageElement?.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="pt-40 pb-20 px-4 overflow-hidden">
      <div className="container mx-auto text-center">
        {/* Title with staggered animation */}
        <h1
          ref={titleRef}
          className={`text-5xl md:text-8xl lg:text-[105px] pb-6 font-extrabold tracking-tighter bg-gradient-to-br from-gray-900 to-gray-500 text-transparent bg-clip-text transition-all duration-1000 ease-out ${
            isLoaded
              ? "translate-y-0"
              : "translate-y-10"
          }`}
        >
          Control Your Spendings <br /> with Intelligence
        </h1>

        {/* Description with delayed animation */}
        <p
          ref={descRef}
          className={`text-xl text-gray-600 mb-8 max-w-2xl mx-auto transition-all duration-1000 ease-out ${
            isLoaded
              ? "translate-y-0"
              : "translate-y-10"
          }`}
          style={{
            transitionDelay: isLoaded ? "200ms" : "0ms",
          }}
        >
          An AI-powered financial management platform that helps you track,
          analyze, and optimize your spending with real-time insights.
        </p>

        {/* Buttons with staggered animation */}
        <div
          ref={buttonsRef}
          className={`flex justify-center space-x-4 transition-all duration-1000 ease-out ${
            isLoaded
              ? "translate-y-0"
              : "translate-y-10"
          }`}
          style={{
            transitionDelay: isLoaded ? "400ms" : "0ms",
          }}
        >
          <Link href="/dashboard">
            <Button 
              size="lg" 
              className="px-8 hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              Get Started
            </Button>
          </Link>
          <Link href="/">
            <Button 
              size="lg" 
              variant="outline" 
              className="px-8 hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              Watch Demo
            </Button>
          </Link>
        </div>

        {/* Hero image with parallax and fade effect */}
        <div className="hero-image-wrapper mt-5 md:mt-0">
          <div
            ref={imageRef}
            className={`hero-image transition-all duration-1000 ease-out ${
              isLoaded
                ? "translate-y-0"
                : "translate-y-20"
            }`}
            style={{
              transitionDelay: isLoaded ? "600ms" : "0ms",
            }}
          >
            <Image
              src="/banner.png"
              width={1280}
              height={720}
              alt="Dashboard Preview"
              className="rounded-lg shadow-2xl border mx-auto hover:shadow-3xl transition-shadow duration-500"
              priority
            />
          </div>
        </div>
      </div>

      {/* Scroll indicator with animation */}
      <div className="flex justify-center mt-12">
        <div className="animate-bounce">
          <svg
            className="w-6 h-6 text-gray-400 hover:text-gray-600 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
