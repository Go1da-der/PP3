exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable();
    table.string('password_hash').notNullable();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.string('avatar_url');
    table.enum('role', ['admin', 'manager', 'developer', 'tester']).defaultTo('developer');
    table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
    table.string('phone');
    table.json('preferences').defaultTo('{}');
    table.boolean('email_notifications').defaultTo(true);
    table.boolean('push_notifications').defaultTo(true);
    table.boolean('telegram_notifications').defaultTo(false);
    table.string('telegram_chat_id');
    table.timestamp('last_login_at');
    table.timestamp('email_verified_at');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
