## Project Commands

- Add and run auto-fix command before commits to ensure code quality and consistency
- Use the uv created .venv when trying to run python code or python tests
- Use semantic versioning commit messages
- After you make non trival changes, run ruff linting, then ruff formating, then the tests
- Always use semantic commit messages.
- To build the frontend, always run from project root: `uv run python align_browser/build.py experiment-data/test-experiments --output-dir align_browser/static --build-only`

## Testing

- **Run all tests**: `uv run pytest -v`
- **Run frontend tests frequently during refactoring - after every 2-3 small changes**
- Pytest automatically handles the build process via the `built_frontend` fixture
- Tests include comprehensive browser automation with Playwright
- The `built_frontend` fixture generates test data and builds the frontend before running tests
- Tests verify UI loading, dropdowns, scenario selection (both base and specific), results display, console errors, and responsive layout
- Never change test intentions just to make them pass in some cases

## Data Modeling

- We have Pydantic models that represent the input and output JSON

## Data Models

- **InputOutputItem**: Represents scenario input/output data with input choices and ADM decisions
- **InputData**: Contains scenario choices array with unstructured text and KDMA associations
- **Choice objects**: Each choice has unstructured text, action_id, action_type, character_id, kdma_association
- **Output data**: Contains choice index (integer) and action object with justification
- **ADM Decision extraction**: Use choice index from output.choice to get input.choices[index].unstructured for readable choice text
- **Justification location**: Found at output.action.justification, always present
- **Scores and timing**: Separate Pydantic models for structured score and timing data
- Always refer to the Pydantic model definitions in src/experiment_models.py for the exact field structure and types when working with experiment data