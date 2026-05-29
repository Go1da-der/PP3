exports.up = function(knex) {
  return knex.schema.createTable('notification_recipients', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('notification_id').references('id').inTable('notifications').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('team_id').references('id').inTable('teams').onDelete('CASCADE');
    table.enum('status', ['pending', 'delivered', 'read', 'failed']).defaultTo('pending');
    table.json('delivery_results').defaultTo('{}');
    table.timestamp('read_at');
    table.timestamp('delivered_at');
    table.timestamp('failed_at');
    table.text('failure_reason');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('notification_recipients');
};
