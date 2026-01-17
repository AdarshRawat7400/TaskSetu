function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
        var folderName = "TaskSetu_Uploads";

        // Handle Delete Action
        if (data.action === 'delete') {
            try {
                var fileToDelete = DriveApp.getFileById(data.fileId);
                fileToDelete.setTrashed(true);
                return ContentService.createTextOutput(JSON.stringify({
                    status: "success",
                    message: "File moved to trash"
                })).setMimeType(ContentService.MimeType.JSON);
            } catch (err) {
                return ContentService.createTextOutput(JSON.stringify({
                    status: "error",
                    message: "File not found or already deleted: " + err.toString()
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        var folder;

        // Check if folder exists, if not create it
        var folders = DriveApp.getFoldersByName(folderName);
        if (folders.hasNext()) {
            folder = folders.next();
        } else {
            folder = DriveApp.createFolder(folderName);
        }

        // Decode Base64
        var blob = Utilities.newBlob(Utilities.base64Decode(data.file), data.mimeType, data.filename);
        var file = folder.createFile(blob);

        // Set permission to anyone with link can view (so images load in the app)
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            url: file.getDownloadUrl(),
            id: file.getId(),
            viewLink: file.getUrl()
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            status: "error",
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}
