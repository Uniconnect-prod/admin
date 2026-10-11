import { sourceDataService } from '../services/sourceDataService.js';
import { getReportingDb } from '../config/mongo.js';

export const reportController = {
  async getOverview(req, res) {
    try {
      const { range = '30d', from, to } = req.query;
      const platformCode = req.activePlatform?.isAll ? 'ALL' : req.activePlatform?.code;

      const overviewData = await sourceDataService.getOverview({
        platformCode,
        range,
        from,
        to
      });

      // Fetch recent audit activity from reporting database
      let recentActivity = [];
      try {
        const rDb = getReportingDb();
        const logs = await rDb.collection('admin_audit_logs')
          .find({})
          .sort({ created_at: -1 })
          .limit(8)
          .toArray();

        recentActivity = logs.map(a => ({
          id: a._id.toString(),
          action: a.action,
          entity: a.entity,
          user: a.user_name || 'System Admin',
          details: a.metadata?.details || `${a.action} on ${a.entity}`,
          timestamp: a.created_at
        }));
      } catch (e) {
        console.error('Error fetching recent audit logs:', e);
      }

      overviewData.charts.recentActivity = recentActivity;

      return res.status(200).json({
        success: true,
        data: overviewData
      });
    } catch (err) {
      console.error('[ReportController] getOverview error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve overview reports from live MongoDB.' });
    }
  },

  async getRevenueReport(req, res) {
    try {
      const { range = '30d', from, to } = req.query;
      const platformCode = req.activePlatform?.isAll ? 'ALL' : req.activePlatform?.code;

      const revenueData = await sourceDataService.getRevenueReport({
        platformCode,
        range,
        from,
        to
      });

      return res.status(200).json({
        success: true,
        data: revenueData
      });
    } catch (err) {
      console.error('[ReportController] getRevenueReport error:', err);
      return res.status(500).json({ success: false, message: 'Failed to generate revenue report.' });
    }
  },

  async getGrowthReport(req, res) {
    try {
      const { range = '30d', from, to } = req.query;
      const platformCode = req.activePlatform?.isAll ? 'ALL' : req.activePlatform?.code;

      const overview = await sourceDataService.getOverview({
        platformCode,
        range,
        from,
        to
      });

      return res.status(200).json({
        success: true,
        data: {
          monthlyCohort: overview.charts.subscriberGrowth.map(g => ({
            month: g.date,
            net_additions: g.net,
            active: g.active,
            churned: g.churned
          }))
        }
      });
    } catch (err) {
      console.error('[ReportController] getGrowthReport error:', err);
      return res.status(500).json({ success: false, message: 'Failed to generate growth report.' });
    }
  },

  // Super Admin Cross-Platform Comparison
  async getPlatformComparison(req, res) {
    try {
      if (!req.user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          code: 'SUPER_ADMIN_REQUIRED',
          message: 'Cross-platform comparison is restricted to Super Admin.'
        });
      }

      // Fetch live business comparison metrics from source MongoDB
      const businessComparison = await sourceDataService.getPlatformComparison();

      // Fetch user authorization stats from reporting admin database
      const rDb = getReportingDb();
      const nowIso = new Date().toISOString();
      const nowPlus7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const accessRows = await rDb.collection('admin_platform_access').find({}).toArray();

      const comparison = businessComparison.map(plat => {
        const platAccess = accessRows.filter(a => a.platform_id === plat.platformId);
        const uniqueUsers = new Set(platAccess.map(a => a.user_id));

        const activeUsers = platAccess.filter(a =>
          a.status === 'ACTIVE' && a.start_date <= nowIso && a.end_date >= nowIso
        ).length;

        const upcomingUsers = platAccess.filter(a =>
          a.status === 'ACTIVE' && a.start_date > nowIso
        ).length;

        const expiredUsers = platAccess.filter(a =>
          a.status === 'ACTIVE' && a.end_date < nowIso
        ).length;

        const expiringSoon = platAccess.filter(a =>
          a.status === 'ACTIVE' && a.end_date >= nowIso && a.end_date <= nowPlus7d
        ).length;

        const renRateNum = parseFloat(String(plat.renewalRate).replace('%', '')) || 0;

        return {
          ...plat,
          totalUsers: uniqueUsers.size,
          activeUsers,
          upcomingUsers,
          expiredUsers,
          expiringSoon,
          renewalRateValue: renRateNum
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          comparison,
          charts: {
            revenueComparison: comparison.map(c => ({ name: c.name, revenue: c.revenue })),
            subscriberComparison: comparison.map(c => ({ name: c.name, subscribers: c.subscribers })),
            renewalRateComparison: comparison.map(c => ({ name: c.name, rate: c.renewalRateValue })),
            churnComparison: comparison.map(c => ({ name: c.name, churn: c.churn }))
          }
        }
      });
    } catch (err) {
      console.error('[ReportController] getPlatformComparison error:', err);
      return res.status(500).json({ success: false, message: 'Failed to generate platform comparison.' });
    }
  },

  async getSubscriptionBusinessReport(req, res) {
    try {
      const { from, to, debug } = req.query;
      const platformCode = req.activePlatform?.isAll ? 'ALL' : req.activePlatform?.code;
      const report = await sourceDataService.getSubscriptionBusinessReport({
        platformCode,
        startDate: from || '2026-09-01T00:00:00.000Z',
        endDate: to || '2026-10-01T00:00:00.000Z',
        debug: debug === 'true' || debug === true
      });
      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (err) {
      console.error('[ReportController] getSubscriptionBusinessReport error:', err);
      return res.status(500).json({ success: false, message: 'Failed to generate subscription business report.' });
    }
  }
};
