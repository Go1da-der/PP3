exports.up = function(knex) {
  return knex.schema.createTable('delivery_channels', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.enum('type', ['email', 'telegram', 'slack', 'push', 'webhook']).notNullable();
    table.json('config').defaultTo('{}');
    table.boolean('enabled').defaultTo(true);
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('delivery_channels');
};
