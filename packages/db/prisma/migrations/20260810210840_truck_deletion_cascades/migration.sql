-- DropForeignKey
ALTER TABLE "menu_categories" DROP CONSTRAINT "menu_categories_truck_id_fkey";

-- DropForeignKey
ALTER TABLE "menu_items" DROP CONSTRAINT "menu_items_truck_id_fkey";

-- DropForeignKey
ALTER TABLE "review_photos" DROP CONSTRAINT "review_photos_truck_id_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_truck_id_fkey";

-- DropForeignKey
ALTER TABLE "truck_events" DROP CONSTRAINT "truck_events_truck_id_fkey";

-- DropForeignKey
ALTER TABLE "truck_locations" DROP CONSTRAINT "truck_locations_truck_id_fkey";

-- DropForeignKey
ALTER TABLE "truck_operators" DROP CONSTRAINT "truck_operators_truck_id_fkey";

-- DropForeignKey
ALTER TABLE "truck_schedules" DROP CONSTRAINT "truck_schedules_truck_id_fkey";

-- AlterTable
ALTER TABLE "review_photos" ALTER COLUMN "truck_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "reviews" ALTER COLUMN "truck_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "truck_operators" ADD CONSTRAINT "truck_operators_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_locations" ADD CONSTRAINT "truck_locations_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_schedules" ADD CONSTRAINT "truck_schedules_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_photos" ADD CONSTRAINT "review_photos_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_events" ADD CONSTRAINT "truck_events_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
