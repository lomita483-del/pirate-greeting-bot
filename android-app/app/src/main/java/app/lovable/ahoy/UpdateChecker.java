package app.lovable.ahoy;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.TimeUnit;

public final class UpdateChecker {
    private static final String MANIFEST = "https://ahoy.lovable.app/app-release.json";
    private static final String VERSION = "1.0.0";
    private static final int BUILD = 1;
    private static final String WORK = "ahoy-update-check";

    public static void schedule(Context context) {
        createChannel(context);
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(UpdateWorker.class, 6, TimeUnit.HOURS)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, request);
        checkNow(context);
    }

    static void checkNow(Context context) {
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(MANIFEST).openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setRequestProperty("Cache-Control", "no-cache, no-store");
            connection.setRequestProperty("Pragma", "no-cache");
            if (connection.getResponseCode() != 200) return;
            BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
            reader.close();
            JSONObject release = new JSONObject(body.toString());
            int latestBuild = release.optInt("latestBuild", BUILD);
            String download = release.optString("downloadUrl", "");
            if (latestBuild <= BUILD || download.isEmpty()) return;
            String latestVersion = release.optString("latestVersion", VERSION);
            boolean force = release.optBoolean("forceUpdate", false);
            showUpdateNotification(context, latestVersion, download, force);
        } catch (Exception ignored) {}
    }

    private static void showUpdateNotification(Context context, String version, String download, boolean force) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(download));
        PendingIntent pending = PendingIntent.getActivity(context, 1001, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, "ahoy_updates")
            .setSmallIcon(app.lovable.ahoy.R.mipmap.ic_launcher)
            .setContentTitle("Ahoy update available")
            .setContentText("Version " + version + " is ready to download.")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(
                force ? "A required Ahoy update is available. Tap to download it." : "A new Ahoy version is available. Tap to download it."
            ))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending);
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(1001, builder.build());
    }

    private static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel("ahoy_updates", "Ahoy Updates", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Notifications when a new Ahoy app version is available.");
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    public static class UpdateWorker extends Worker {
        public UpdateWorker(Context context, WorkerParameters params) { super(context, params); }
        @Override public Result doWork() {
            checkNow(getApplicationContext());
            return Result.success();
        }
    }
}
