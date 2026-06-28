-- Broadcast notifications (admin announcements) are not tied to an order.
ALTER TABLE "Notification" ALTER COLUMN "orderId" DROP NOT NULL;
