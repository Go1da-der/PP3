exports.up = function(knex) {
  return knex.schema.createTable('notifications', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title').notNullable();
    table.text('message').notNullable();
    table.enum('type', ['info', 'warning', 'error', 'success']).defaultTo('info');
    table.enum('priority', ['low', 'medium', 'high', 'critical']).defaultTo('medium');
    table.json('channels').defaultTo('["web"]');
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('scheduled_for');
    table.timestamp('expires_at');
    table.json('metadata').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('notifications');
};
