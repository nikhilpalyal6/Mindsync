import React, { useState, useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import './pricing.css';

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');

  useEffect(() => {
    AOS.init({
      duration: 400,
      once: true,
    });
  }, []);

  const handleBillingCycle = (cycle) => {
    setBillingCycle(cycle);
  };

  const getPrice = (monthlyPrice) => {
    if (billingCycle === 'yearly') {
      return (monthlyPrice * 12 * 0.7).toFixed(0);
    }
    return monthlyPrice;
  };

  const plans = [
    {
      name: 'Free',
      tagline: 'Perfect for getting started',
      monthlyPrice: 0,
      features: [
        'Up to 10 users',
        'Basic email support',
        '5GB secure storage',
        'Limited platform integrations',
        'Core features access',
      ],
      popular: false,
    },
    {
      name: 'Standard',
      tagline: 'Best for growing teams',
      monthlyPrice: 50,
      features: [
        'Up to 50 users',
        'Priority email support',
        '50GB secure storage',
        'Multiple platform integrations',
        'Advanced analytics',
        'Automation tools',
        'API access',
      ],
      popular: true,
    },
    {
      name: 'Premium',
      tagline: 'For large enterprises',
      monthlyPrice: 150,
      features: [
        'Unlimited users',
        '24/7 phone support',
        'Unlimited secure storage',
        'All available integrations',
        'Advanced analytics',
        'Full automation suite',
        'Priority API access',
        'Dedicated account manager',
      ],
      popular: false,
    },
  ];

  return (
    <div className="pricing-container">
      <div className="pricing-hero">
        <div className="pricing-header" data-aos="fade-up">
          <span className="pricing-badge">Simple Pricing</span>
          <h1 className="pricing-title">
            Choose Your <span className="gradient-text">Perfect Plan</span>
          </h1>
          <p className="pricing-subtitle">
            Transparent pricing with no hidden fees. Start free and upgrade as you grow.
          </p>

          <div className="billing-toggle-wrapper" data-aos="fade-up" data-aos-delay="100">
            <div className="billing-toggle">
              <button
                className={`toggle-option ${billingCycle === 'monthly' ? 'active' : ''}`}
                onClick={() => handleBillingCycle('monthly')}
              >
                Monthly
              </button>
              <button
                className={`toggle-option ${billingCycle === 'yearly' ? 'active' : ''}`}
                onClick={() => handleBillingCycle('yearly')}
              >
                Yearly
              </button>
              {billingCycle === 'yearly' && (
                <span className="save-badge">Save 30%</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pricing-cards-wrapper">
        <div className="pricing-cards">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`pricing-card ${plan.popular ? 'popular' : ''}`}
              data-aos={index === 0 ? 'fade-right' : index === 1 ? 'fade-up' : 'fade-left'}
              data-aos-delay={index * 100}
            >
              {plan.popular && (
                <div className="popular-badge">
                  <span>Most Popular</span>
                </div>
              )}
              <div className="card-header">
                <h2 className="plan-name">{plan.name}</h2>
                <p className="plan-tagline">{plan.tagline}</p>
              </div>

              <div className="price-section">
                <div className="price-wrapper">
                  <span className="currency">$</span>
                  <span className="price-amount">
                    {billingCycle === 'yearly' && plan.monthlyPrice > 0
                      ? getPrice(plan.monthlyPrice)
                      : plan.monthlyPrice}
                  </span>
                  <span className="price-period">
                    /{billingCycle === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {billingCycle === 'yearly' && plan.monthlyPrice > 0 && (
                  <p className="price-note">
                    ${plan.monthlyPrice}/month billed annually
                  </p>
                )}
              </div>

              <button className={`cta-button ${plan.popular ? 'primary' : 'secondary'}`}>
                {plan.monthlyPrice === 0 ? 'Get Started Free' : 'Start Free Trial'}
              </button>

              <div className="features-list">
                <ul>
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>
                      <svg className="check-icon" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M16.7071 5.29289C17.0976 5.68342 17.0976 6.31658 16.7071 6.70711L8.70711 14.7071C8.31658 15.0976 7.68342 15.0976 7.29289 14.7071L3.29289 10.7071C2.90237 10.3166 2.90237 9.68342 3.29289 9.29289C3.68342 8.90237 4.31658 8.90237 4.70711 9.29289L8 12.5858L15.2929 5.29289C15.6834 4.90237 16.3166 4.90237 16.7071 5.29289Z"
                          fill="currentColor"
                        />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="compare-section">
        <div className="compare-header" data-aos="fade-up">
          <span className="compare-badge">Feature Comparison</span>
          <h2 className="compare-title">Compare All Plans</h2>
          <p className="compare-subtitle">
            See exactly what's included in each plan to make the best choice for your needs.
          </p>
        </div>

        <div className="compare-table-wrapper" data-aos="fade-up" data-aos-delay="100">
          <div className="compare-table">
            <table>
              <thead>
                <tr>
                  <th className="feature-col">Features</th>
                  <th>
                    <div className="plan-header">
                      <span className="plan-name-header">Free</span>
                      <span className="plan-price-header">${getPrice(0)}/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                    </div>
                  </th>
                  <th className="popular-col">
                    <div className="plan-header">
                      <span className="plan-name-header">Standard</span>
                      <span className="plan-price-header">${getPrice(50)}/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                    </div>
                  </th>
                  <th>
                    <div className="plan-header">
                      <span className="plan-name-header">Premium</span>
                      <span className="plan-price-header">${getPrice(150)}/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="feature-name">User Accounts</td>
                  <td>Up to 10</td>
                  <td className="popular-col">Up to 50</td>
                  <td>Unlimited</td>
                </tr>
                <tr>
                  <td className="feature-name">Storage</td>
                  <td>5GB</td>
                  <td className="popular-col">50GB</td>
                  <td>Unlimited</td>
                </tr>
                <tr>
                  <td className="feature-name">Core Features</td>
                  <td><span className="check-mark">✓</span></td>
                  <td className="popular-col"><span className="check-mark">✓</span></td>
                  <td><span className="check-mark">✓</span></td>
                </tr>
                <tr>
                  <td className="feature-name">Advanced Analytics</td>
                  <td><span className="cross-mark">—</span></td>
                  <td className="popular-col"><span className="check-mark">✓</span></td>
                  <td><span className="check-mark">✓</span></td>
                </tr>
                <tr>
                  <td className="feature-name">Automation Tools</td>
                  <td><span className="cross-mark">—</span></td>
                  <td className="popular-col"><span className="check-mark">✓</span></td>
                  <td><span className="check-mark">✓</span></td>
                </tr>
                <tr>
                  <td className="feature-name">API Access</td>
                  <td><span className="cross-mark">—</span></td>
                  <td className="popular-col"><span className="check-mark">✓</span></td>
                  <td><span className="check-mark">✓</span></td>
                </tr>
                <tr>
                  <td className="feature-name">Support</td>
                  <td>Email</td>
                  <td className="popular-col">24/7 Chat</td>
                  <td>Priority + Phone</td>
                </tr>
                <tr>
                  <td className="feature-name">Account Manager</td>
                  <td><span className="cross-mark">—</span></td>
                  <td className="popular-col"><span className="cross-mark">—</span></td>
                  <td><span className="check-mark">✓</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pricing-faq" data-aos="fade-up">
        <div className="faq-header">
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="faq-grid">
          <div className="faq-item">
            <h3>Can I change plans later?</h3>
            <p>Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
          </div>
          <div className="faq-item">
            <h3>What payment methods do you accept?</h3>
            <p>We accept all major credit cards, PayPal, and bank transfers for annual plans.</p>
          </div>
          <div className="faq-item">
            <h3>Is there a free trial?</h3>
            <p>Yes! All paid plans come with a 14-day free trial. No credit card required.</p>
          </div>
          <div className="faq-item">
            <h3>Do you offer refunds?</h3>
            <p>We offer a 30-day money-back guarantee on all annual subscriptions.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
