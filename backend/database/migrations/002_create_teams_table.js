exports.up = function(knex) {
  return knex.schema.createTable('teams', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('description');
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.string('avatar_url');
    table.json('settings').defaultTo('{}');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('teams');
};
