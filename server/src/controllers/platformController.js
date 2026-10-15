export const platformController = {
  // Public showcase for the login page carousel (no auth required, no platform data).
  async getPublicShowcase(req, res) {
    const showcasePlatforms = [
      {
        code: 'UNISOLUTION_CORE',
        name: 'Mobile Technology',
        highlight: 'Solution',
        badge: 'Telecom & Digital Solutions',
        description: 'Pioneering innovative mobile solutions and high-performance telecom technologies for leading operators worldwide.',
        bgImage: '/brand/unisolution_hero.jpg',
        stats: [
          { label: 'Users Enabled', value: '30M+' },
          { label: 'Telecom Products', value: '10+' },
          { label: 'Active Markets', value: '5+' }
        ]
      },
      {
        code: 'UNISOLUTION_GATEWAY',
        name: 'Unified Telco',
        highlight: 'Gateway',
        badge: 'Core Infrastructure',
        description: 'Carrier-grade API engine unifying high-throughput SMS, USSD, voice IVR, verification pipelines, and direct operator billing.',
        bgImage: '/brand/unisolution_hero.jpg',
        stats: [
          { label: 'Uptime SLA', value: '99.99%' },
          { label: 'Processing Speed', value: 'Sub-50ms' },
          { label: 'Global Reach', value: '1B+' }
        ]
      },
      {
        code: 'UNISOLUTION_VAS',
        name: 'Consumer Digital',
        highlight: 'Ecosystem',
        badge: 'Digital Platforms',
        description: 'Next-generation digital services powering interactive contest campaigns, streaming entertainment, and mobile fintech solutions.',
        bgImage: '/brand/unisolution_hero.jpg',
        stats: [
          { label: 'Active Services', value: '380+' },
          { label: 'Partner Rating', value: '4.9 / 5' },
          { label: 'Global Partners', value: '10+' }
        ]
      }
    ];
    res.json({ success: true, data: showcasePlatforms });
  },

  /**
   * Platforms the current user may select, re-evaluated against access windows on every call.
   */
  async getAuthorizedPlatforms(req, res) {
    res.json({ success: true, data: req.user.platforms });
  }
};
