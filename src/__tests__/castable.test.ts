import {castable, dumpCastableCache} from "../castable";
import {UserModel} from "./lib/UserModel";
import {autorun} from "mobx";

describe('castable', () => {
  beforeEach(() => dumpCastableCache());

  it('should cast a model', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
    });

    const editableUser = EditableUser(user);

    expect(editableUser.firstName).toBe('Test');
    expect(editableUser.somethingElse).toBe('test');

    editableUser.setFirstName('Test 2');

    expect(editableUser.firstName).toBe('Test 2');
    expect(user.firstName).toBe('Test');
  });

  it('can memoize casted instances', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
      lastName: 'Johnson',
    });

    const editableUser = EditableUser(user);
    const editableUser2 = EditableUser(user)

    expect(editableUser === editableUser2).toBe(true);
  });

  it('can update casted instances', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
      lastName: 'gyuhhhhuhggg'
    });

    const editableUser = EditableUser(user);
    editableUser.setFirstName('Test 2');

    expect(editableUser.firstName).toBe('Test 2');
    expect(user.firstName).toBe('Test');

    user.assign({ firstName: 'Test 3' });

    expect(user.firstName).toBe('Test 3');
    expect(editableUser.firstName).toBe('Test 3');
  });

  it('can chain casts', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
      lastName: 'Johnson',
    });

    const beepableEditableUser = BeepableUser(EditableUser(user));

    expect(beepableEditableUser.firstName).toBe('Test');
    expect(beepableEditableUser.somethingElse).toBe('test');
    expect(beepableEditableUser.beepBoop).toBe(0);
  });

  it('preserves observability', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
      lastName: 'Johnson',
    });

    const editableUser = EditableUser(user);

    const spy = jest.fn();

    autorun(() => {
      spy(editableUser.firstName);
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith('Test');

    editableUser.setFirstName('Test 2');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith('Test 2');
  });

  it('preserves model behvaior', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
    });

    const editableUser = EditableUser(user);

    // Selection error
    expect(() => editableUser.lastName).toThrowError();
  })
});

const EditableUser = castable(UserModel, {
  somethingElse: 'test',
  setFirstName(firstName: string) {
    this.firstName = firstName;
  },
});

const BeepableUser = castable(UserModel, {
  beepBoop: 0,
  beep() {
    this.beepBoop++;
  }
});
