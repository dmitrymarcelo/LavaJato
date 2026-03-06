BEGIN;

CREATE TABLE IF NOT EXISTS checklist_images (
    id BIGSERIAL PRIMARY KEY,
    checklist_id BIGINT NOT NULL,
    image_name VARCHAR(255),
    content_type VARCHAR(100) NOT NULL,
    image_data BYTEA NOT NULL,
    image_size_bytes INTEGER,
    photo_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_checklist_images_checklist
        FOREIGN KEY (checklist_id)
        REFERENCES checklists(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checklist_images_checklist_id
    ON checklist_images (checklist_id);

CREATE INDEX IF NOT EXISTS idx_checklist_images_photo_type
    ON checklist_images (photo_type);

COMMIT;
