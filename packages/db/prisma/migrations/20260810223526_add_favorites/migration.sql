-- CreateTable
CREATE TABLE "truck_favorites" (
    "truck_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "truck_favorites_pkey" PRIMARY KEY ("truck_id","user_id")
);

-- CreateTable
CREATE TABLE "menu_item_favorites" (
    "menu_item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_favorites_pkey" PRIMARY KEY ("menu_item_id","user_id")
);

-- AddForeignKey
ALTER TABLE "truck_favorites" ADD CONSTRAINT "truck_favorites_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_favorites" ADD CONSTRAINT "truck_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_favorites" ADD CONSTRAINT "menu_item_favorites_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_favorites" ADD CONSTRAINT "menu_item_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
