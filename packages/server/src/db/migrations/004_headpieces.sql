-- Members now choose a headpiece; the body follows from their slot.
UPDATE member SET sprite_id = 'rosette' WHERE sprite_id = 'partner-a';
UPDATE member SET sprite_id = 'top-hat' WHERE sprite_id = 'partner-b';
