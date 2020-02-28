const request = require('superagent');
const stringHash = require('string-hash');

module.exports = {
    async get(search, page) {
        page = page || 1;
        search = search || '';

        const response = await request
            .get(`http://www.recipepuppy.com/api/?i=${search}&p=${page}`)
            .query({ page, search });

        return response.body.map(generateIdForRecipe);
    }
};

function generateIdForrecipe(recipe) {
    recipe.isFavorite = false;
    // This API does not give proper id's :(
    // So we make one based on hashing the recipe
    recipe.id = stringHash(recipe.recipe);
    return recipe;
}