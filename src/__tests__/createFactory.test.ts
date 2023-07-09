import {createFactory} from "../createFactory";

describe('createFactory', () => {
  test('can extend an object', () => {
    type User = {
      __typename: 'User';
      firstName: string;
      lastName: string;
    }

    const user: User = {
      __typename: 'User',
      firstName: 'Jimmy',
      lastName: 'John'
    };

    const EditableUser = createFactory<User>()({
      extraState: 0,
      setFirstName(firstName: string) {
        this.firstName = firstName;
      },
      setExtraState(state: number) {
        this.extraState = state;
      }
    });

    const editableUser = EditableUser(user);

    expect(editableUser).toMatchObject({
      __typename: 'User',
      firstName: 'Jimmy',
      lastName: 'John',
      extraState: 0
    });

    editableUser.setFirstName('Joe');
    editableUser.setExtraState(1);

    expect(editableUser).toMatchObject({
      __typename: 'User',
      firstName: 'Joe',
      lastName: 'John',
      extraState: 1
    });

    expect(user).toMatchObject({
      __typename: 'User',
      firstName: 'Jimmy',
      lastName: 'John'
    });

    // Should be equal if we run the same user through the factory again
    const editableUser2 = EditableUser(user);
    expect(editableUser2).toBe(editableUser);
  })
});