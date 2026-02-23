class UserMapper {
    static toViewModel(user) {
        return {
            username: user.username,
            imageUrl: user.image_url,
            age: user.age,
            gender: user.gender,
            isNew: user.is_new,
            numViewers: user.num_viewers,
            tags: user.tags,
            birthday: user.birthday,
            description: user.description,
            isOnline: user.current_show === 'public',
        };
    }
}
