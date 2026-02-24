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

    static toSummary(user) {
        return {
            username: user.username,
            age: user.age,
            numViewers: user.num_viewers ?? user.numViewers,
            tagCount: Array.isArray(user.tags) ? user.tags.length : 0,
            isOnline: user.isOnline ?? user.current_show === 'public',
        };
    }

    static sortByViewers(users, descending = true) {
        return [...users].sort((a, b) => {
            const viewersA = a.num_viewers ?? a.numViewers ?? 0;
            const viewersB = b.num_viewers ?? b.numViewers ?? 0;
            return descending ? viewersB - viewersA : viewersA - viewersB;
        });
    }

    static groupByTag(users) {
        const groups = {};
        for (const user of users) {
            const tags = Array.isArray(user.tags) ? user.tags : [];
            for (const tag of tags) {
                if (!groups[tag]) {
                    groups[tag] = [];
                }
                groups[tag].push(user.username);
            }
        }
        return groups;
    }
}
