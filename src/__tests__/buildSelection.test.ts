import {buildSelection} from "../buildSelection";
import dedent from "dedent";

describe('buildSelection', () => {
  it('should build a selection', () => {
    const selection = buildSelection([
      {
        fieldName: 'todos',
        children: [
          {
            fieldName: 'id',
          },
          {
            fieldName: 'completed',
          },
        ],
      },
    ]);

    expect(selection).toEqual(dedent`
      {
        todos {
          id
          completed
        }
      }
    `);
  });

  it('can handle field args', () => {
    const selection = buildSelection([
      {
        fieldName: 'todos',
        children: [
          {
            fieldName: 'id',
          },
          {
            fieldName: 'completed',
          },
          {
            fieldName: 'commentors',
            args: {
              limit: 10,
              sort: 'ascending',
              object: {
                id: 1,
                name: 'Test',
              }
            },
            children: [
              {
                fieldName: 'id',
              },
              {
                fieldName: 'name',
              }
            ]
          }
        ],
        args: {
          limit: 10,
          completed: false,
        }
      },
    ]);

    expect(selection).toEqual(dedent`
      {
        todos(limit: 10, completed: false) {
          id
          completed
          commentors(limit: 10, sort: "ascending", object: {id: 1, name: "Test"}) {
            id
            name
          }
        }
      }
    `);
  });
});