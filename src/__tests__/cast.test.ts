import {action, makeAutoObservable} from "mobx";
import {cast, Castable} from "../cast";
import {Selectable} from "../decorators/Selectable";
import {PostModel} from "./lib/PostModel";
import {UserMetadataModel} from "./lib/UserMetadataModel";
import {assignInstanceProperties} from "../lib/assignInstanceProperties";

describe('cast', () => {
  it('should cast a model', () => {
    const user = new UserBaseModel({
      id: 1,
      firstName: 'Test',
    });

    const editableUser = cast(user, EditableUser);

    expect(editableUser.firstName).toBe('Test');
    expect(editableUser.somethingElse).toBe('test');

    editableUser.setFirstName('Test 2');

    expect(editableUser.firstName).toBe('Test 2');
    expect(user.firstName).toBe('Test');
  });

  it('can memoize casted instances', () => {
    const user = new UserBaseModel({
      id: 1,
      firstName: 'Test',
    });

    const editableUser = cast(user, EditableUser);
    const editableUser2 = cast(user, EditableUser);

    expect(editableUser).toBe(editableUser2);
  });

  it('can update casted instances', () => {
    const user = new UserBaseModel({
      id: 1,
      firstName: 'Test',
    });

    const editableUser = cast(user, EditableUser);
    editableUser.setFirstName('Test 2');

    expect(editableUser.firstName).toBe('Test 2');
    expect(user.firstName).toBe('Test');

    user.assign({ firstName: 'Test 3' });

    expect(user.firstName).toBe('Test 3');
    expect(editableUser.firstName).toBe('Test 3');
  });
});

export class UserBaseModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  @Selectable() declare id: string
  @Selectable() declare firstName: string
  @Selectable() declare lastName: string;
  @Selectable() declare posts: PostModel[]
  @Selectable() declare metadata: UserMetadataModel;

  constructor(init: any) {
    this.assign(init)

    makeAutoObservable(this);
  }

  assign(data: Partial<UserBaseModel>) {
    assignInstanceProperties(this, data);
  }

  get selectedData() {
    const data = {};
    const keys = ['id', 'firstName', 'lastName', 'posts', 'metadata'];

    keys.forEach(key => {
      try {
        // @ts-ignore
        data[key as any] = this[key as any] as any; // TODO: Types
      } catch (err) {
        // TODO: Check for SelectionError
      }
    });

    return data;
  }
}

class EditableUser implements Castable<UserBaseModel> {
  firstName: string;
  somethingElse: string;

  constructor(user: UserBaseModel) {
    this.firstName = user.firstName;
    this.somethingElse = 'test';

    makeAutoObservable(this);
  }

  receiveModel(user: UserBaseModel): void {
    this.firstName = user.firstName;
  }

  setFirstName(firstName: string) {
    this.firstName = firstName;
  }
}