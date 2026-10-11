import { sourceDataService } from '../services/sourceDataService.js';

export const subscriberController = {
  async getSubscribers(req, res) {
    try {
      const {
        search,
        status,
        offer_code,
        from,
        to,
        page = 1,
        limit = 10
      } = req.query;

      const platformCode = req.activePlatform?.isAll ? 'ALL' : req.activePlatform?.code;

      const result = await sourceDataService.getSubscribers({
        platformCode,
        search,
        status,
        offer_code,
        from,
        to,
        page,
        limit
      });

      return res.status(200).json({
        success: true,
        data: {
          records: result.subscribers,
          pagination: {
            totalRecords: result.pagination.total,
            totalPages: result.pagination.totalPages,
            currentPage: result.pagination.page,
            limit: result.pagination.limit
          },
          filterOptions: {
            offerCodes: ['9923310010', '9919910026', '9923310009'],
            statuses: ['Active', 'Inactive', 'Renewal', 'Suspended', 'Deactivated'],
            lifecycles: ['ACTIVE', 'CHURNED']
          }
        }
      });
    } catch (err) {
      console.error('[SubscriberController] getSubscribers error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve subscriber list from live MongoDB.' });
    }
  },

  async getSubscriberById(req, res) {
    try {
      const { id } = req.params;
      const platformCode = req.activePlatform?.isAll ? 'ALL' : req.activePlatform?.code;

      const details = await sourceDataService.getSubscriberDetails(id, platformCode);
      if (!details || !details.subscriber) {
        return res.status(404).json({ success: false, message: 'Subscriber not found in live records.' });
      }

      return res.status(200).json({
        success: true,
        data: details
      });
    } catch (err) {
      console.error('[SubscriberController] getSubscriberById error:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve subscriber details.' });
    }
  }
};
