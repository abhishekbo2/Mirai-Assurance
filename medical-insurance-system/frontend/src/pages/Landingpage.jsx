import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

export default function LandingPage() {
  const slides = [
    {
      image: "/slider/slide1.jpg",
      title: "Protect Your Health",
      desc: "Smart medical insurance for your future.",
    },
    {
      image: "/slider/slide2.jpg",
      title: "Family Health Coverage",
      desc: "Secure your loved ones with reliable insurance.",
    },
    {
      image: "/slider/slide3.jpg",
      title: "Cashless Hospitals",
      desc: "Access thousands of partner hospitals.",
    },
  ];

  const reviews = [
    {
      name: "Ramesh Kumar",
      text: "Mirai Assurance helped me during a medical emergency. Cashless hospital service worked perfectly.",
      rating: 5,
    },
    {
      name: "Priya Sharma",
      text: "Affordable plans and very easy claim process. Highly recommended for families.",
      rating: 4,
    },
    {
      name: "Arjun Patel",
      text: "Great insurance support and fast approvals. Very professional platform.",
      rating: 5,
    },
  ];

  const [current, setCurrent] = useState(0);
  const [reviewIndex, setReviewIndex] = useState(0);

  useEffect(() => {
    const slider = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(slider);
  }, [slides.length]);

  useEffect(() => {
    const reviewSlider = setInterval(() => {
      setReviewIndex((prev) => (prev + 1) % reviews.length);
    }, 4000);
    return () => clearInterval(reviewSlider);
  }, [reviews.length]);

  return (
    <div className="landing-wrapper p-1 bg-blue-100 min-h-screen">
      <section
        className="hero"
        style={{
          backgroundImage: `url(${slides[current].image})`,
          backgroundPosition: "center center",
        }}
      >
        <div className="overlay"></div>
        <div className="hero-container">
          <div className="hero-left">
            <h1 className="hero-main">Mirai Assurance</h1>
            <p className="hero-sub">Smart Medical Insurance Platform</p>
            <Link to="/signin">
              <button className="btn-start">Get Started</button>
            </Link>
          </div>

          <div className="hero-right">
            <h2 className="slider-title">{slides[current].title}</h2>
            <p className="slider-text">{slides[current].desc}</p>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="features">
        <h2>Why Choose Mirai Assurance?</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>🏥 Cashless Hospitals</h3>
            <p>Access thousands of hospitals without upfront payment.</p>
          </div>
          <div className="feature-card">
            <h3>💳 Affordable Plans</h3>
            <p>Insurance plans designed for every family.</p>
          </div>
          <div className="feature-card">
            <h3>⚡ Fast Claim Process</h3>
            <p>Quick claim approval and digital processing.</p>
          </div>
        </div>
      </section>

      {/* REVIEWS SECTION */}
      <section className="reviews">
        <h2>Customer Reviews</h2>
        <div className="review-carousel">
          <p className="review-text">"{reviews[reviewIndex].text}"</p>
          <div className="review-stars">
            {"⭐".repeat(reviews[reviewIndex].rating)}
          </div>
          <h4 className="review-name">— {reviews[reviewIndex].name}</h4>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="cta">
        <h2>Secure Your Future Today</h2>
        <p>Join thousands of customers who trust Mirai Assurance.</p>
        <Link to="/signin">
          <button className="btn-start">Start Your Coverage</button>
        </Link>
      </section>

      <footer className="footer">
        <h3>Mirai Assurance</h3>
        <p>© 2026 Mirai Assurance • All Rights Reserved</p>
      </footer>
    </div>
  );
}
